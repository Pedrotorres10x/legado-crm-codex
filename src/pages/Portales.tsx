import PortalFeedsManager from '@/components/PortalFeedsManager';
import PortalLeadStats from '@/components/PortalLeadStats';

const Portales = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Portales</h1>
        <p className="text-muted-foreground">Gestión de feeds XML para portales inmobiliarios</p>
      </div>
      <PortalLeadStats />
      <PortalFeedsManager />
    </div>
  );
};

export default Portales;
