import { Button } from "@/components/ui/button";

type ContactsHeaderProps = {
  isMobile: boolean;
  setDialogOpen: (open: boolean) => void;
  peopleScope: "all" | "circle";
  setPeopleScope: (scope: "all" | "circle") => void;
  pipelineTab: "captacion" | "compradores" | "cerrados" | "red";
  setPipelineTab: (tab: "captacion" | "compradores" | "cerrados" | "red") => void;
  peopleBaseTotal: number;
  relationshipBaseCount: number;
  pipelineContactsLength: number;
};

export default function ContactsHeader({
  isMobile,
  setDialogOpen,
  peopleScope,
  setPeopleScope,
  pipelineTab,
  setPipelineTab,
  peopleBaseTotal,
  relationshipBaseCount,
  pipelineContactsLength,
}: ContactsHeaderProps) {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">Bandeja de personas</h2>
          <p className="text-sm text-muted-foreground">
            {peopleScope === 'circle'
              ? `${pipelineContactsLength} personas del círculo de influencia visibles para trabajar relación y referral.`
              : `${peopleBaseTotal} personas registradas para captar, vender y cuidar relaciones.`}
          </p>
        </div>
        {!isMobile && (
          <Button onClick={() => setDialogOpen(true)}>Añadir persona</Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all', label: `Toda la base (${peopleBaseTotal})` },
          { key: 'circle', label: `Solo círculo de influencia (${relationshipBaseCount})` },
        ].map((option) => (
          <Button
            key={option.key}
            variant={peopleScope === option.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setPeopleScope(option.key as "all" | "circle");
              if (option.key === 'circle' && pipelineTab !== 'red') {
                setPipelineTab('red');
              }
            }}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </>
  );
}
