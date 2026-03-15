interface PipelineFunnelProps {
  contacts: any[];
  stages: { key: string; label: string; color: string }[];
}

const PipelineFunnel = ({ contacts, stages }: PipelineFunnelProps) => {
  const total = contacts.length || 1;
  const maxWidth = 100;

  return (
    <div className="space-y-1 max-w-xl mx-auto py-4">
      {stages.map((stage, i) => {
        const count = contacts.filter(c => (c as any).pipeline_stage === stage.key).length;
        const pct = Math.max((count / total) * maxWidth, 15);
        const widthStyle = i === 0 ? '100%' : `${Math.max(100 - (i * (80 / (stages.length - 1))), 20)}%`;

        return (
          <div key={stage.key} className="flex items-center gap-3">
            <div
              className={`${stage.color} rounded-lg py-3 px-4 text-center transition-all duration-500 text-white font-medium text-sm`}
              style={{ width: widthStyle, minWidth: '120px' }}
            >
              {stage.label}
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold">{count}</span>
              <span className="text-xs text-muted-foreground">
                ({total > 0 ? Math.round((count / contacts.length) * 100) : 0}%)
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PipelineFunnel;
