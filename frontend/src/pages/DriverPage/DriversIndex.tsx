import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDriversList } from "../../hooks/useDriverList";
import { Loader } from "../../components/Loader";

export const DriversIndex = () => {
  const { data, isLoading, error } = useDriversList();
  const navigate = useNavigate();

  useEffect(() => {
    if (data?.length) {
      const defaultDriver = data.find(d => d.id === 1) ?? data[0];
      navigate(`/drivers/${defaultDriver.id}`, { replace: true });
    }
  }, [data, navigate]);

  if (isLoading) return <Loader label="Loading drivers…" full />;
  if (error) return <div style={{ color: "crimson" }}>Failed to load drivers.</div>;
  return <div>No drivers yet.</div>;
}