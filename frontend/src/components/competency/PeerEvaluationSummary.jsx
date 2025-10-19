import React, { useEffect, useMemo, useState } from "react";
import { peer } from "../../services/competencyApi";
import { normalizePeerScore, scoreCollaboration } from "../../utils/scoring";

export default function PeerEvaluationSummary({ user, periodKey, selfEvalScore /*0..100*/ }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    peer.received(user.id, periodKey).then(setData).catch(()=>setData(null));
  }, [user.id, periodKey]);

  const peerAvg100 = useMemo(() => {
    if (!data?.summary?.avg) return 0;
    const dims = data.summary.avg;
    // เฉลี่ย 5 มิติ แล้วแปลง 1..5 → 0..100
    const vals = ["communication","teamwork","responsibility","cooperation","adaptability"]
      .map(k => Number(dims[k] || 0)).filter(Boolean);
    if (!vals.length) return 0;
    const mean5 = vals.reduce((a,b)=>a+b,0)/vals.length; // 1..5
    return normalizePeerScore(mean5); // 0..100
  }, [data]);

  const collab = scoreCollaboration({ self: selfEvalScore || 0, peerAvg: peerAvg100 });

  return (
    <div className="card border-0 shadow-sm rounded-4">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center">
          <h6 className="mb-0">สรุปผลการประเมินโดยเพื่อน (รอบ {periodKey})</h6>
          <span className="badge text-bg-primary rounded-pill">
            คะแนนการทำงานร่วมกับผู้อื่น: {collab.score}/100
          </span>
        </div>

        <div className="small text-muted mt-2">
          Peer avg ≈ {peerAvg100}/100 · Self ≈ {selfEvalScore ?? 0}/100 · w(Self: {Math.round(collab.wSelf*100)}%, Peer: {Math.round(collab.wPeer*100)}%)
        </div>

        {!!data?.items?.length && (
          <details className="mt-2">
            <summary className="small">ดูความเห็น (ซ่อนชื่อผู้ประเมิน)</summary>
            <ul className="mt-2 small">
              {data.items
                .filter(x => x.comment)
                .map((x, i) => <li key={i}>{x.comment}</li>)}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
