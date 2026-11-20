'use client';

/* Lista de actividad reciente (se muestra en Control Center). */
import { useActivity, clearActivity } from '@/lib/activity';
import { pushToast } from '@/lib/store';
import {
  IcFolder, IcFolderPlus, IcBranch, IcCommit, IcIssue, IcPR, IcSearch, IcCompare, IcUpload, IcWifi,
  IcCode, IcArchive, IcLock, IcKey, IcShield, IcEdit, IcRotate, IcCheck, IcX, IcMerge, IcTrash,
  IcFork, IcGlobe, IcAlert, IcInfo, IcChat, IcZap, IcActivity,
} from './Icons';

export const ACT_ICONS: Record<string, React.ReactNode> = {
  folder: <IcFolder size={13} />, 'folder-plus': <IcFolderPlus size={13} />, branch: <IcBranch size={13} />,
  commit: <IcCommit size={13} />, issue: <IcIssue size={13} />, pr: <IcPR size={13} />, search: <IcSearch size={13} />,
  compare: <IcCompare size={13} />, upload: <IcUpload size={13} />, wifi: <IcWifi size={13} />,
  code: <IcCode size={13} />, archive: <IcArchive size={13} />, lock: <IcLock size={13} />, key: <IcKey size={13} />,
  shield: <IcShield size={13} />, edit: <IcEdit size={13} />, rotate: <IcRotate size={13} />, check: <IcCheck size={13} />,
  'x': <IcX size={13} />, merge: <IcMerge size={13} />, trash: <IcTrash size={13} />, fork: <IcFork size={13} />,
  globe: <IcGlobe size={13} />, alert: <IcAlert size={13} />, info: <IcInfo size={13} />, chat: <IcChat size={13} />,
  zap: <IcZap size={13} />,
};

export function ActivityList({ max = 10 }: { max?: number }) {
  const activity = useActivity();
  return (
    <div className="act-list">
      {activity.length
        ? activity.slice(0, max).map((a, i) => (
          <div key={a.t + '-' + i} className="act-item">
            {ACT_ICONS[a.icon] ?? <IcInfo size={13} />}
            <div style={{ minWidth: 0, flex: 1 }}><b>{a.text}</b><span>{a.sub}</span></div>
          </div>
        ))
        : <div className="rail-empty">Sin actividad todavía. Las operaciones que hagas aparecerán aquí.</div>}
      {activity.length ? (
        <button className="chip-btn" style={{ marginTop: 8, alignSelf: 'flex-start' }}
          onClick={() => { clearActivity(); pushToast('Actividad limpiada', 'ok'); }}>
          <IcX size={12} />Limpiar registro
        </button>
      ) : null}
    </div>
  );
}

export function ActivityHeader() {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><IcActivity size={14} /> Actividad</span>;
}
