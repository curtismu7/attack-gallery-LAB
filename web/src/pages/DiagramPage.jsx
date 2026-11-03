import { useEffect, useMemo, useRef, useState } from 'react';
import { Background, BaseEdge, Controls, ConnectionMode, EdgeLabelRenderer, Handle, MarkerType, Position, ReactFlow, getBezierPath } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { getCatalog, runAttack } from '../api.js';
import { CHIP_W, CONTROL_HOST, HOPS, NODES, chipPosition, hopTrace, hopsToRun } from '../data/diagram.js';
import { Loading, useLoad } from '../components/bits.jsx';

// ReactFlow diagram: movable boxes, Simulate, Reset, speed. The hops follow the selected attack; the outcome comes from a real run.
const SIDES = [['t', Position.Top], ['b', Position.Bottom], ['l', Position.Left], ['r', Position.Right]];
const SLOTS = [25, 50, 75];
const slotStyle = (side, i) => ({ [side === 't' || side === 'b' ? 'left' : 'top']: `${SLOTS[i]}%`, opacity: 0 });

function Party({ data }) {
  return (
    <div className={`dnode dnode--${data.kind} ${data.hot ? 'dnode--hot' : ''}`}>
      {SIDES.flatMap(([s, pos]) => SLOTS.map((_, i) => <Handle key={s + i} id={`${s}${i}`} type="source" position={pos} style={slotStyle(s, i)} />))}
      <div className="dnode__t">{data.title}</div><div className="dnode__s">{data.sub}</div>
    </div>
  );
}
function Ctrl({ data }) {
  return (
    <div className={`dctrl ${data.mine ? 'dctrl--mine' : ''} ${data.state ? `dctrl--${data.state}` : ''}`} data-testid={`ctrl-${data.id}`}>
      {SIDES.flatMap(([s, pos]) => <Handle key={s} id={`${s}0`} type="source" position={pos} style={{ opacity: 0 }} />)}
      <span aria-hidden="true">{data.state === 'stopped' ? '■ ' : '◆ '}</span>{data.title}{data.state === 'stopped' ? ' (stopped it)' : ''}
    </div>
  );
}
// An edge with a numbered badge on it (the hop number), so the order reads on the picture as well as in the list below.
function Hop({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, style, data }) {
  const [path, lx, ly] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      {data?.num ? (
        <EdgeLabelRenderer>
          <div className={`hopnum ${data.lit ? 'hopnum--on' : ''} ${data.blocked ? 'hopnum--stop' : ''}`} style={{ transform: `translate(-50%,-50%) translate(${lx}px,${ly}px)` }} data-testid={`hopnum-${data.num}`}>{data.num}</div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
const nodeTypes = { party: Party, ctrl: Ctrl };
const edgeTypes = { hop: Hop };

const POS = Object.fromEntries(NODES.map((n) => [n.id, n]));
const sideFor = (a, b) => { const dx = POS[b].x - POS[a].x; const dy = POS[b].y - POS[a].y; return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? ['r', 'l'] : ['l', 'r']) : (dy > 0 ? ['b', 't'] : ['t', 'b']); };
function wire(hops) {
  const used = {}; const take = (node, side) => { const k = node + side; used[k] = (used[k] ?? -1) + 1; return `${side}${used[k] % 3}`; };
  return hops.map((h) => { const [s, t] = sideFor(h.from, h.to); return { sourceHandle: take(h.from, s), targetHandle: take(h.to, t) }; });
}
const initialControlNodes = (controls) => controls.map((c, i) => ({ id: `ctrl-${c.id}`, type: 'ctrl', position: chipPosition(i), style: { width: CHIP_W }, data: { id: c.id, title: c.id }, draggable: true }));
const initialNodes = (controls) => [...NODES.map((n) => ({ id: n.id, type: 'party', position: { x: n.x, y: n.y }, data: { title: n.title, sub: n.sub, kind: n.kind } })), ...initialControlNodes(controls)];

const initialPositions = (controls) => Object.fromEntries(initialNodes(controls).map((n) => [n.id, n.position]));

export default function DiagramPage({ controls }) {
  const cat = useLoad(getCatalog);
  const [attackId, setAttackId] = useState('audience-confusion');
  const [mode, setMode] = useState('governed');
  const [run, setRun] = useState(null);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [pos, setPos] = useState(() => initialPositions(controls));
  const timer = useRef(null);
  const attack = cat.data?.attacks.find((a) => a.id === attackId);
  const hops = HOPS[attackId] || [];

  useEffect(() => { // the outcome is a real run of the chosen configuration
    let live = true; setRun(null); setStep(0); setPlaying(false);
    runAttack(attackId, mode).then((j) => live && setRun(j.runs[0])).catch(() => live && setRun(null));
    return () => { live = false; };
  }, [attackId, mode]);

  const total = run ? hopsToRun(attackId, run, attack?.control) : hops.length;
  useEffect(() => {
    if (!playing) return undefined;
    if (step >= total) { setPlaying(false); return undefined; }
    timer.current = setTimeout(() => setStep((s) => s + 1), 1100 / speed);
    return () => clearTimeout(timer.current);
  }, [playing, step, total, speed]);

  const simulate = () => { if (!run) return; if (step >= total) setStep(0); setPlaying(true); };
  const reset = () => { setPlaying(false); setStep(0); setPos(initialPositions(controls)); }; // simulation and layout both go back
  const done = step >= total && step > 0;
  const stopped = done && run && !run.succeeded;

  const nodes = useMemo(() => initialNodes(controls).map((n) => {
    const p = { ...n, position: pos[n.id] || n.position };
    if (n.type === 'party') p.data = { ...n.data, hot: hops.slice(0, step).some((h) => h.from === n.id || h.to === n.id) };
    else p.data = { ...n.data, mine: n.data.id === attack?.control, state: n.data.id === attack?.control ? (stopped ? 'stopped' : done ? 'passed' : '') : '' };
    return p;
  }), [controls, pos, step, attack, stopped, done, hops]);
  const edges = useMemo(() => {
    const w = wire(hops);
    const flow = hops.map((h, i) => {
      const lit = i < step; const cur = i === step - 1;
      const blocked = h.step ? lit && hopTrace(run, h)?.verdict === 'refused' : stopped && i === step - 1 && h.ctrl === attack?.control;
      const color = blocked ? 'var(--danger-text)' : lit ? 'var(--accent)' : 'var(--border)';
      return { id: `h${i}`, source: h.from, target: h.to, ...w[i], type: 'hop', animated: cur && playing, data: { num: i + 1, lit, blocked },
        style: { stroke: color, strokeWidth: lit ? 3 : 1.5, opacity: lit || step === 0 ? 1 : 0.45 }, markerEnd: { type: MarkerType.ArrowClosed, color } };
    });
    const host = attack && { id: 'ctrl-edge', source: `ctrl-${attack.control}`, target: CONTROL_HOST[attack.control], sourceHandle: 't0', targetHandle: 'b0', style: { stroke: 'var(--status-ok)', strokeDasharray: '5 4' }, type: 'hop' };
    return host ? [...flow, host] : flow;
  }, [hops, step, playing, attack, stopped, run]);

  const onNodesChange = (changes) => setPos((p) => ({ ...p, ...Object.fromEntries(changes.filter((c) => c.type === 'position' && c.position).map((c) => [c.id, c.position])) }));

  return (
    <>
      <h1>Diagram</h1>
      <p className="lede">The parties and control points. Pick an attack, press Simulate, and the hops light up in order; the outcome comes from a real run of that configuration. Drag any box to rearrange.</p>
      <Loading state={cat}>
        {({ attacks }) => (
          <>
            <div className="actions" role="group" aria-label="Diagram controls">
              <label className="field">Attack
                <select value={attackId} onChange={(e) => setAttackId(e.target.value)}>{attacks.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
              </label>
              <div className="seg" role="group" aria-label="Configuration">
                <button type="button" aria-pressed={mode === 'ungoverned'} onClick={() => setMode('ungoverned')}>Ungoverned</button>
                <button type="button" aria-pressed={mode === 'governed'} onClick={() => setMode('governed')}>Governed</button>
              </div>
              <button type="button" className="primary" onClick={simulate} disabled={!run || playing}>Simulate</button>
              <button type="button" onClick={reset}>Reset</button>
              <label className="field">Speed
                <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Speed">
                  <option value={0.5}>0.5x</option><option value={1}>1x</option><option value={2}>2x</option><option value={4}>4x</option>
                </select>
              </label>
            </div>
            <div className="flow" data-testid="flow" role="group" aria-label="Diagram of parties and control points. The same steps are listed below.">
              <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodesChange={onNodesChange} connectionMode={ConnectionMode.Loose}
                nodesConnectable={false} fitView fitViewOptions={{ padding: 0.1 }} minZoom={0.2} proOptions={{ hideAttribution: true }}>
                <Background /><Controls showInteractive={false} />
              </ReactFlow>
            </div>
            <ol className="hops" data-testid="hops">
              {hops.map((h, i) => (
                <li key={i} className={i < step ? 'hops__on' : i >= total && run ? 'hops__skip' : ''}>
                  {POS[h.from].title} to {POS[h.to].title}: {h.label}
                  {h.ctrl === attack?.control && <span className="badge badge--ok"> control point: {controls.find((c) => c.id === h.ctrl)?.name}</span>}
                  {run && i >= total && <span className="muted"> (does not happen: stopped earlier)</span>}
                </li>
              ))}
            </ol>
            <p className="sr-only" role="status" aria-live="polite">{step ? `Hop ${step} of ${total}` : ''}</p>
            {done && run && (run.succeeded
              ? <p className="outcome outcome--gain" data-testid="diagram-outcome"><strong>Attacker gained:</strong> {run.gain}</p>
              : <p className="outcome outcome--stop" data-testid="diagram-outcome"><strong>{run.refusal?.kind === 'neutralised' ? 'Neutralised' : 'Refused'} at the control point:</strong> {run.refusal?.error}. {run.refusal?.message}</p>)}
          </>
        )}
      </Loading>
    </>
  );
}
