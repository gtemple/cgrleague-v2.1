import os
import aiohttp
import discord
from discord import app_commands
from dotenv import load_dotenv

load_dotenv()

TOKEN        = os.environ["DISCORD_TOKEN"]
GUILD_ID     = int(os.environ["DISCORD_GUILD_ID"])
API_BASE     = os.environ["API_BASE_URL"].rstrip("/")
SITE_URL     = os.environ.get("SITE_URL", "").rstrip("/")
SEASON       = int(os.environ.get("CURRENT_SEASON", 7))

GOLD   = 0xFFC70E
GREEN  = 0x3DDC84
BLUE   = 0x5B8DEF
PURPLE = 0xA855F7
RED    = 0xEF4444
GREY   = 0x6B7280

MEDAL = {1: "🥇", 2: "🥈", 3: "🥉"}
POS   = {1: "P1", 2: "P2", 3: "P3"}

intents = discord.Intents.default()
client  = discord.Client(intents=intents)
tree    = app_commands.CommandTree(client)
guild   = discord.Object(id=GUILD_ID)


async def get(session: aiohttp.ClientSession, path: str, **params):
    url = f"{API_BASE}{path}"
    async with session.get(url, params=params or None) as resp:
        resp.raise_for_status()
        return await resp.json()


def pos_str(i: int) -> str:
    return f"**{POS.get(i+1, f'P{i+1}')}**"


# ─────────────────────────────────────────────────
# /standings
# ─────────────────────────────────────────────────
@tree.command(guild=guild, name="standings", description="Current driver standings")
async def standings(interaction: discord.Interaction):
    await interaction.response.defer()
    async with aiohttp.ClientSession() as s:
        rows = await get(s, f"/api/seasons/{SEASON}/standings/")

    rows = sorted(rows, key=lambda r: -r["points"])
    lines = []
    for i, r in enumerate(rows):
        name  = r["driver"]["display_name"]
        team  = (r.get("team") or {}).get("name") or "—"
        pts   = r["points"]
        medal = MEDAL.get(i + 1, f"`{i+1:>2}.`")
        lines.append(f"{medal} **{name}** · {team} · **{pts} pts**")

    embed = discord.Embed(
        title=f"🏆 Season {SEASON} — Driver Standings",
        description="\n".join(lines) or "No data yet.",
        color=GOLD,
    )
    await interaction.followup.send(embed=embed)


# ─────────────────────────────────────────────────
# /constructors
# ─────────────────────────────────────────────────
@tree.command(guild=guild, name="constructors", description="Current constructor standings")
async def constructors(interaction: discord.Interaction):
    await interaction.response.defer()
    async with aiohttp.ClientSession() as s:
        rows = await get(s, f"/api/seasons/{SEASON}/constructors/")

    rows = sorted(rows, key=lambda r: -r["points"])
    lines = []
    for i, r in enumerate(rows):
        name  = (r.get("team") or {}).get("name") or "Unknown"
        pts   = r["points"]
        medal = MEDAL.get(i + 1, f"`{i+1:>2}.`")
        lines.append(f"{medal} **{name}** · **{pts} pts**")

    embed = discord.Embed(
        title=f"🔧 Season {SEASON} — Constructor Standings",
        description="\n".join(lines) or "No data yet.",
        color=PURPLE,
    )
    await interaction.followup.send(embed=embed)


# ─────────────────────────────────────────────────
# /lastrace
# ─────────────────────────────────────────────────
@tree.command(guild=guild, name="lastrace", description="Most recent race podium")
async def lastrace(interaction: discord.Interaction):
    await interaction.response.defer()
    async with aiohttp.ClientSession() as s:
        data = await get(s, f"/api/seasons/{SEASON}/last-race/")

    last = data.get("last_race")
    if not last:
        await interaction.followup.send("No races completed yet this season.")
        return

    race   = last["race"]
    track  = race["track"]["name"]
    round_ = race["round"]
    sprint = " · Sprint" if race.get("is_sprint") else ""
    title  = f"🏁 R{round_} · {track}{sprint}"

    lines = []
    for r in last.get("results", []):
        pos   = r["finish_position"]
        name  = r["driver"]["display_name"]
        team  = (r.get("team") or {}).get("name") or "—"
        pts   = r["points"]
        flags = []
        if r.get("fastest_lap"):
            flags.append("⚡ FL")
        if r.get("dotd"):
            flags.append("⭐ DOTD")
        flag_str = f"  {' · '.join(flags)}" if flags else ""
        medal = MEDAL.get(pos, f"P{pos}")
        lines.append(f"{medal} **{name}** · {team} · {pts} pts{flag_str}")

    link_line = ""
    if SITE_URL:
        link_line = f"\n[View full results →]({SITE_URL}/seasons/{SEASON}/races/{round_})"

    embed = discord.Embed(
        title=title,
        description="\n".join(lines) + link_line,
        color=GREEN,
    )
    await interaction.followup.send(embed=embed)


# ─────────────────────────────────────────────────
# /nextrace
# ─────────────────────────────────────────────────
@tree.command(guild=guild, name="nextrace", description="Upcoming race info")
async def nextrace(interaction: discord.Interaction):
    await interaction.response.defer()
    async with aiohttp.ClientSession() as s:
        data = await get(s, "/api/teasers/next-race/", include_sprints="1")

    upcoming = data.get("upcoming_race")
    if not upcoming:
        await interaction.followup.send("No upcoming races this season.")
        return

    race   = upcoming["race"]
    track  = upcoming["track"]
    round_ = race["round"]
    sprint = " · Sprint" if race.get("is_sprint") else ""

    location = ", ".join(filter(None, [track.get("city"), track.get("country")]))

    lines = [
        f"🏟️  **{track['name']}**",
        f"📍  {location}" if location else "",
        f"📋  Round {round_}{sprint}",
    ]

    recent = data.get("recent_winners", [])
    if recent:
        lines.append("")
        lines.append("**Previous Winners at this track:**")
        for w in recent[:3]:
            lines.append(f"· S{w['season_id']} — {w['driver']['display_name']}")

    embed = discord.Embed(
        title=f"📅 Next Race — Season {SEASON}",
        description="\n".join(l for l in lines if l is not None),
        color=BLUE,
    )
    await interaction.followup.send(embed=embed)


# ─────────────────────────────────────────────────
# /driver
# ─────────────────────────────────────────────────
@tree.command(guild=guild, name="driver", description="Look up a driver's stats")
@app_commands.describe(name="Driver name (partial match works)")
async def driver(interaction: discord.Interaction, name: str):
    await interaction.response.defer()
    async with aiohttp.ClientSession() as s:
        results = await get(s, "/api/drivers/", q=name)

        if not results:
            await interaction.followup.send(f"No driver found matching **{name}**.")
            return

        # If multiple matches, pick closest
        driver_obj = results[0]
        driver_id  = driver_obj["id"]

        history = await get(s, f"/api/drivers/{driver_id}/history/")

    driver_info = history.get("driver", {})
    display     = driver_info.get("display_name") or driver_obj.get("display_name") or name
    country     = driver_info.get("country_of_representation") or driver_obj.get("country_of_representation")

    # Aggregate career stats across all seasons
    wins = podiums = poles = fl = 0
    current_pts = None

    for entry in history.get("history", []):
        wins    += entry.get("wins", 0)
        podiums += entry.get("podiums", 0)
        poles   += entry.get("poles", 0)
        fl      += entry.get("fastest_laps", 0)
        if (entry.get("season") or {}).get("id") == SEASON:
            current_pts = entry.get("points")

    lines = [
        f"🌍  {country}" if country else "",
        "",
        "**Career**",
        f"🏁  Wins: **{wins}**",
        f"🥇  Podiums: **{podiums}**",
        f"🔵  Poles: **{poles}**",
        f"⚡  Fastest Laps: **{fl}**",
    ]

    if current_pts is not None:
        lines += [
            "",
            f"**Season {SEASON}**",
            f"📊  {current_pts} pts",
        ]

    if len(results) > 1:
        others = ", ".join(r["display_name"] for r in results[1:4])
        lines += ["", f"*Also matched: {others}*"]

    embed = discord.Embed(
        title=f"👤 {display}",
        description="\n".join(l for l in lines if l is not None),
        color=GREY,
    )
    await interaction.followup.send(embed=embed)


# ─────────────────────────────────────────────────
# /articles
# ─────────────────────────────────────────────────
TYPE_LABEL = {
    "RECAP":           "Recap",
    "PREVIEW":         "Preview",
    "POWER_RANKINGS":  "Power Rankings",
}
TYPE_EMOJI = {
    "RECAP":           "📋",
    "PREVIEW":         "🔭",
    "POWER_RANKINGS":  "📊",
}

@tree.command(guild=guild, name="articles", description="Latest articles")
async def articles(interaction: discord.Interaction):
    await interaction.response.defer()
    async with aiohttp.ClientSession() as s:
        latest = await get(s, "/api/articles/latest/")

    lines = []
    for key in ("recap", "preview", "rankings"):
        a = latest.get(key)
        if not a:
            continue
        emoji = TYPE_EMOJI.get(a["type"], "📄")
        label = TYPE_LABEL.get(a["type"], a["type"])
        race  = a.get("race")
        loc   = f"R{race['round']} · {race['track']['name']}" if race else ""
        title = a["title"]
        if SITE_URL:
            lines.append(f"{emoji} **{label}**{f'  ·  {loc}' if loc else ''}\n[{title}]({SITE_URL}/articles/{a['id']})")
        else:
            lines.append(f"{emoji} **{label}**{f'  ·  {loc}' if loc else ''}\n{title}")

    embed = discord.Embed(
        title="📰 Latest Articles",
        description="\n\n".join(lines) or "No articles yet.",
        color=PURPLE,
    )
    await interaction.followup.send(embed=embed)


# ─────────────────────────────────────────────────
# Startup
# ─────────────────────────────────────────────────
@client.event
async def on_ready():
    await tree.sync(guild=guild)
    print(f"✓ Logged in as {client.user} — synced slash commands to guild {GUILD_ID}")


client.run(TOKEN)
