import PortalFeedsManager from '@/components/PortalFeedsManager';
import PortalLeadStats from '@/components/PortalLeadStats';
import XmlFeedsManager from '@/components/XmlFeedsManager';

const Portales = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Portales</h1>
        <p className="text-muted-foreground">Gestión de feeds XML para portales inmobiliarios</p>
      </div>
      <PortalLeadStats />
      <PortalFeedsManager />
      <div className="pt-4">
        <div className="mb-3">
          <h2 className="text-lg font-semibold">Feeds de entrada (HabiHub / XML)</h2>
          <p className="text-sm text-muted-foreground">
            Aquí se gestionan los feeds de captación automática de inmuebles.
          </p>
        </div>
        <XmlFeedsManager />
      </div>
    </div>
  );
};

export default Portales;
