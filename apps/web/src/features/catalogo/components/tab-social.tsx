import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CatalogSettingsProps } from "./catalog";

interface TabSocialProps {
  settings: CatalogSettingsProps;
  setSettings: (settings: CatalogSettingsProps) => void;
}

export function TabSocial({ settings, setSettings }: TabSocialProps) {
  return (
    <div className="space-y-6 mt-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Redes Sociais</h2>
        <p className="text-sm text-muted-foreground">
          Conecte suas redes sociais ao catálogo
        </p>
      </div>

      <Card className="p-6">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="instagram">Instagram</Label>
            <Input
              id="instagram"
              placeholder="@minhaloja ou https://instagram.com/minhaloja"
              value={settings.instagram}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  instagram: e.target.value,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="facebook">Facebook</Label>
            <Input
              id="facebook"
              placeholder="https://facebook.com/minhaloja"
              value={settings.facebook}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  facebook: e.target.value,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kwai">KWAI</Label>
            <Input
              id="kwai"
              placeholder="https://kwai.com/minhaloja"
              value={settings.kwai}
              onChange={(e) =>
                setSettings({ ...settings, kwai: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="x">X (Twitter)</Label>
            <Input
              id="x"
              placeholder="https://x.com/minhaloja"
              value={settings.twitter}
              onChange={(e) =>
                setSettings({ ...settings, twitter: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="youtube">YouTube</Label>
            <Input
              id="youtube"
              placeholder="https://youtube.com/minhaloja"
              value={settings.youtube}
              onChange={(e) =>
                setSettings({ ...settings, youtube: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tiktok">TikTok</Label>
            <Input
              id="tiktok"
              placeholder="https://tiktok.com/minhaloja"
              value={settings.tiktok}
              onChange={(e) =>
                setSettings({ ...settings, tiktok: e.target.value })
              }
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
