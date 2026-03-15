UPDATE matches m
SET agent_id = c.agent_id
FROM demands d
JOIN contacts c ON c.id = d.contact_id
WHERE m.demand_id = d.id
  AND m.agent_id IS NULL
  AND c.agent_id IS NOT NULL;