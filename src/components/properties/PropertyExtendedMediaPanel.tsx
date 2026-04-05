import { useRef } from 'react';
import { Globe, Loader2, Trash2, Upload, Video } from 'lucide-react';

import * as AccordionUI from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type PropertyVideo = {
  name?: string;
  url?: string;
  file_name?: string;
  [key: string]: unknown;
};

type PropertyExtendedMediaPanelProps = {
  videos: PropertyVideo[];
  virtualTour: string;
  savingTour: boolean;
  uploading: boolean;
  isAdmin: boolean;
  isCoordinadora: boolean;
  onVirtualTourChange: (value: string) => void;
  onSaveVirtualTour: () => void;
  onUploadVideos: (files: FileList) => void;
  onDeleteVideo: (fileName: string) => void;
};

const PropertyExtendedMediaPanel = ({
  videos,
  virtualTour,
  savingTour,
  uploading,
  isAdmin,
  isCoordinadora,
  onVirtualTourChange,
  onSaveVirtualTour,
  onUploadVideos,
  onDeleteVideo,
}: PropertyExtendedMediaPanelProps) => {
  const videoInputRef = useRef<HTMLInputElement>(null);

  return (
    <AccordionUI.AccordionItem value="media" className="border-b border-border/60">
      <AccordionUI.AccordionTrigger className="px-6 py-4 hover:no-underline">
        <div className="min-w-0 text-left">
          <p className="text-base font-semibold flex items-center gap-2">
            <Video className="h-4 w-4 text-primary" />
            Media ampliada
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Videos y tour virtual del inmueble.
          </p>
        </div>
      </AccordionUI.AccordionTrigger>
      <AccordionUI.AccordionContent className="px-6 pb-6 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Video className="h-4 w-4 text-primary" />
                Videos ({videos.length})
              </CardTitle>
              {(isAdmin || isCoordinadora) && (
                <div>
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    multiple
                    hidden
                    onChange={(event) => event.target.files && onUploadVideos(event.target.files)}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => videoInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    ) : (
                      <Upload className="h-3.5 w-3.5 mr-1" />
                    )}
                    Subir videos
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {videos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Video className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>Sin videos. Sube videos del inmueble.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {videos.map((video) => (
                  <div
                    key={`${video.isXml ? 'xml' : 'storage'}-${video.name}`}
                    className="relative group rounded-xl overflow-hidden bg-muted"
                  >
                    {video.isXml && video.url.match(/youtube\.com|youtu\.be|vimeo\.com/) ? (
                      <iframe
                        src={video.url.replace('watch?v=', 'embed/')}
                        className="w-full aspect-video rounded-xl"
                        allowFullScreen
                        title={video.name}
                      />
                    ) : (
                      <video src={video.url} controls className="w-full rounded-xl" />
                    )}
                    {video.isXml && (
                      <span className="absolute top-2 left-2 text-[10px] bg-primary/80 text-primary-foreground px-1.5 py-0.5 rounded">
                        XML
                      </span>
                    )}
                    {!video.isXml && (isAdmin || isCoordinadora) && (
                      <button
                        className="absolute top-2 right-2 h-7 w-7 rounded-full bg-destructive/80 text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => onDeleteVideo(video.name)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              Tour Virtual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Pega aqui la URL del tour virtual (Matterport, 360, etc.)"
                value={virtualTour}
                onChange={(event) => onVirtualTourChange(event.target.value)}
              />
              <Button onClick={onSaveVirtualTour} disabled={savingTour} size="sm">
                {savingTour ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Guardar'}
              </Button>
            </div>
            {virtualTour && (
              <div className="rounded-xl overflow-hidden border aspect-video">
                <iframe src={virtualTour} className="w-full h-full" allowFullScreen title="Tour Virtual" />
              </div>
            )}
          </CardContent>
        </Card>
      </AccordionUI.AccordionContent>
    </AccordionUI.AccordionItem>
  );
};

export default PropertyExtendedMediaPanel;
