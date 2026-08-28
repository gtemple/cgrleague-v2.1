"""
Provider layer for article generation.

Two backends, selected by ARTICLE_LLM_PROVIDER (or a --provider flag on the
management commands): "deepseek" (default) and "anthropic".

They differ in one way that shapes this module. Anthropic enforces the JSON
schema server-side through `output_config`, so a parsed response is guaranteed
to match. DeepSeek only offers `json_object` mode, which guarantees *valid
JSON* but not that it matches the schema, so that path ships the schema in the
prompt and validates the result before handing it back. Callers get the same
contract either way: a dict that satisfies `schema`, or an exception.
"""
import json
import logging
import os

logger = logging.getLogger(__name__)

ANTHROPIC = "anthropic"
DEEPSEEK = "deepseek"

ANTHROPIC_MODEL = "claude-opus-4-8"
# deepseek-v4-flash is cheaper again; -pro reads better for prose, and is still
# roughly an order of magnitude under Opus on output tokens.
DEEPSEEK_MODEL = "deepseek-v4-pro"
DEEPSEEK_BASE_URL = "https://api.deepseek.com"
# Reasoning was off here on the theory that these prompts hand the model every
# fact it needs and only ask for prose. The prose was never the problem. With
# thinking disabled, a Chinese GP recap put Verstappen five points ahead of a
# driver he led by 22, called an 11th a driver's first scoreless race of a
# season that already held a 20th, and read a 98-point total as a 98-point
# lead. Every one of those is arithmetic over a table that was sitting in the
# prompt. At effort "low" they went away.
# The cost is real — a recap runs 80-170s instead of ~24s — so "low" rather
# than the "high" DeepSeek would pick for itself. Set DEEPSEEK_REASONING_EFFORT
# =none to go back to prose-only speed for a bulk regeneration.
DEEPSEEK_REASONING_EFFORT = "low"
# Reasoning tokens come out of max_tokens, so a budget sized for prose alone
# truncates the moment thinking is switched on. Callers size max_tokens for the
# article they want; this is the trace's share on top of it.
DEEPSEEK_REASONING_HEADROOM = 8000

_override = None


def set_provider(name):
    """Force a provider for this process, overriding the environment."""
    global _override
    if name and name not in (ANTHROPIC, DEEPSEEK):
        raise ValueError(f"Unknown provider '{name}' (expected {ANTHROPIC} or {DEEPSEEK})")
    _override = name or None


def active_provider():
    return _override or os.environ.get("ARTICLE_LLM_PROVIDER", DEEPSEEK).strip().lower()


def active_model(provider=None):
    provider = provider or active_provider()
    if provider == DEEPSEEK:
        return os.environ.get("DEEPSEEK_MODEL", DEEPSEEK_MODEL)
    return os.environ.get("ANTHROPIC_MODEL", ANTHROPIC_MODEL)


# ─── schema validation (DeepSeek path) ───────────────────────────────────────

def _validate(data, schema, path="response"):
    """
    Check a parsed payload against the subset of JSON Schema these prompts use:
    object/array nesting, `required`, and primitive types. Raises ValueError
    naming the offending path so a bad generation is debuggable.
    """
    expected = schema.get("type")

    if expected == "object":
        if not isinstance(data, dict):
            raise ValueError(f"{path}: expected an object, got {type(data).__name__}")
        for key in schema.get("required", []):
            if key not in data:
                raise ValueError(f"{path}: missing required key '{key}'")
        for key, sub in schema.get("properties", {}).items():
            if key in data:
                _validate(data[key], sub, f"{path}.{key}")

    elif expected == "array":
        if not isinstance(data, list):
            raise ValueError(f"{path}: expected an array, got {type(data).__name__}")
        item_schema = schema.get("items")
        if item_schema:
            for i, item in enumerate(data):
                _validate(item, item_schema, f"{path}[{i}]")

    elif expected == "string":
        if not isinstance(data, str):
            raise ValueError(f"{path}: expected a string, got {type(data).__name__}")
        limit = schema.get("maxLength")
        if limit is not None and len(data) > limit:
            raise ValueError(f"{path}: {len(data)} chars exceeds maxLength {limit}")

    elif expected == "integer" and not isinstance(data, int):
        raise ValueError(f"{path}: expected an integer, got {type(data).__name__}")

    return data


# ─── providers ───────────────────────────────────────────────────────────────

def _first_json_object(text):
    """
    Parse the first complete JSON value in `text`, ignoring anything after it.

    json_object mode sometimes appends a second object or a stray line once the
    payload is article-length, which makes json.loads fail the whole response
    with "Extra data" even though the article itself parsed fine. raw_decode
    stops at the end of the first value, so that case is recovered rather than
    retried.
    """
    value, _ = json.JSONDecoder().raw_decode(text)
    return value


def _anthropic_json(user_prompt, schema, *, system, max_tokens):
    import anthropic

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY environment variable is not set")

    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model=active_model(ANTHROPIC),
        max_tokens=max_tokens,
        thinking={"type": "adaptive"},
        system=system,
        messages=[{"role": "user", "content": user_prompt}],
        output_config={"format": {"type": "json_schema", "schema": schema}},
    )
    # With thinking on, content leads with thinking blocks; the constrained JSON
    # is in the text block.
    text = next((b.text for b in message.content if b.type == "text"), "")
    return json.loads(text)


def _deepseek_json(user_prompt, schema, *, system, max_tokens):
    from openai import OpenAI

    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        raise RuntimeError("DEEPSEEK_API_KEY environment variable is not set")

    # json_object mode needs the word "json" in the prompt and only promises
    # syntactic validity, so the schema goes in as an instruction and the
    # result is checked on the way out.
    system_with_schema = (
        f"{system}\n\n"
        "Reply with a single json object and nothing else. No markdown fences, "
        "no commentary before or after. It must conform to this JSON schema:\n"
        f"{json.dumps(schema, indent=2)}"
    )

    effort = os.environ.get("DEEPSEEK_REASONING_EFFORT", DEEPSEEK_REASONING_EFFORT).strip().lower()
    if effort in ("none", "off", "disabled", ""):
        thinking = {"thinking": {"type": "disabled"}}
    else:
        thinking = {"thinking": {"type": "enabled"}, "reasoning_effort": effort}
        max_tokens += DEEPSEEK_REASONING_HEADROOM

    client = OpenAI(api_key=api_key, base_url=DEEPSEEK_BASE_URL)

    last_error = None
    # Three attempts, not two: json_object mode fails intermittently on
    # article-length output and a single retry was observed losing an article.
    for attempt in range(3):
        response = client.chat.completions.create(
            model=active_model(DEEPSEEK),
            max_tokens=max_tokens,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_with_schema},
                {"role": "user", "content": user_prompt},
            ],
            extra_body=thinking,
        )
        choice = response.choices[0]
        text = (choice.message.content or "").strip()

        # A truncated response is not worth retrying blind: with reasoning on,
        # max_tokens is shared with the reasoning trace, so the retry hits the
        # same ceiling. Say what actually happened instead.
        if choice.finish_reason == "length":
            details = response.usage.completion_tokens_details
            reasoning = getattr(details, "reasoning_tokens", 0) if details else 0
            raise RuntimeError(
                f"DeepSeek hit max_tokens ({max_tokens}) before finishing the JSON "
                f"({reasoning} of those went to reasoning). Raise max_tokens, or set "
                f"DEEPSEEK_REASONING_EFFORT=none."
            )

        if not text:
            last_error = ValueError("DeepSeek returned empty content")
            logger.warning("DeepSeek returned empty content (attempt %s/3)", attempt + 1)
            continue
        try:
            return _validate(_first_json_object(text), schema)
        except (json.JSONDecodeError, ValueError) as e:
            last_error = e
            logger.warning("DeepSeek response rejected (attempt %s/3): %s", attempt + 1, e)

    raise RuntimeError(f"DeepSeek failed to return a valid response: {last_error}")


_PROVIDERS = {ANTHROPIC: _anthropic_json, DEEPSEEK: _deepseek_json}


def generate_json(user_prompt, schema, *, system, max_tokens=4000):
    """
    Single entry point for every model call in the articles app. Returns a dict
    conforming to `schema`, whichever provider served it.
    """
    provider = active_provider()
    fn = _PROVIDERS.get(provider)
    if fn is None:
        raise RuntimeError(
            f"Unknown ARTICLE_LLM_PROVIDER '{provider}' (expected {ANTHROPIC} or {DEEPSEEK})"
        )
    return fn(user_prompt, schema, system=system, max_tokens=max_tokens)
