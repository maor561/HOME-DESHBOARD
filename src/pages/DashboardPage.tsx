import type { CSSProperties } from 'react';
import { Clock } from '../components/dashboard/widgets';
import { useDashboard } from '../hooks/useDashboard';
import { BoardLayout } from '../layouts/BoardLayout';
import { GlassLayout } from '../layouts/GlassLayout';
import '../styles/dashboard.css';

const LAYOUTS = { glass: GlassLayout, board: BoardLayout };

/** המסך הקבוע בבית. מותאם ל-16:9 ומתכווץ בפרופורציה לכל גודל מסך. */
export function DashboardPage() {
  const model = useDashboard();
  const Layout = LAYOUTS[model.settings.style];
  const [s1, s2, s3] = model.sky.colors;
  const vars = { '--s1': s1, '--s2': s2, '--s3': s3, '--glow': model.sky.glow, '--veil': model.sky.veil, '--ts': model.settings.textScale } as CSSProperties;

  return (
    <div className="dashboard-root">
      <div className="stage" data-scheme={model.sky.scheme} data-phase={model.phase} data-weather={model.weather.kind} data-dim={model.dim ? 1 : 0} data-board-font={model.settings.boardFont} style={vars}>
        <Layout model={model} />
        <div className="layer dim" aria-hidden={!model.dim}>
          <div>
            <Clock value={model.clock} />
            <p>לילה טוב, {model.familyName}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
