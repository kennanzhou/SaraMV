'use client';

import { useAppStore } from '@/store/appStore';
import Module1Lyrics from '@/components/Module1Lyrics';
import Module2Song from '@/components/Module2Song';
import Module3Storyboard from '@/components/Module3Storyboard';
import Module4Video from '@/components/Module4Video';
import Module5Video from '@/components/Module5Video';

export default function Home() {
  const currentModule = useAppStore((s) => s.currentModule);

  const renderModule = () => {
    switch (currentModule) {
      case 1:
        return <Module1Lyrics />;
      case 2:
        return <Module2Song />;
      case 3:
        return <Module3Storyboard />;
      case 4:
        return <Module4Video />;
      case 5:
        return <Module5Video />;
      default:
        return <Module1Lyrics />;
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {renderModule()}
    </div>
  );
}
