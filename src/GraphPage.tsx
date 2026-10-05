import { useEffect, useMemo, useState } from 'react'
import { ReactFlow, Background, Controls, MarkerType, useNodesState, type Edge, type Node, type ReactFlowInstance } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Link } from 'react-router-dom'
import { cases } from './data/cases'
import { graphItems, graphLinks } from './data/graph'

const core = graphItems.filter(item => item.kind === 'core').map(item => item.id)
const allNodes: Node[] = graphItems.map(item => ({
  id: item.id, position: { x: item.x, y: item.y }, data: { label: item.id },
  className: `graph-node ${item.kind}`,
}))

export default function GraphPage() {
  const [visible, setVisible] = useState<string[]>(core)
  const [selected, setSelected] = useState('利益诱导')
  const [flow, setFlow] = useState<ReactFlowInstance | null>(null)
  const selectedItem = graphItems.find(item => item.id === selected)!
  const related = cases.filter(item => item.nodes.includes(selected)).slice(0, 3)
  const visibleSet = useMemo(() => new Set(visible), [visible])
  const [nodes, , onNodesChange] = useNodesState(allNodes)
  const graphNodes = nodes.filter(item => visibleSet.has(item.id)).map(item => ({ ...item, className: `${item.className || ''} ${selected === item.id ? 'selected' : ''}` }))
  const graphEdges: Edge[] = graphLinks.filter(([a, b]) => visibleSet.has(a) && visibleSet.has(b)).map(([a, b]) => ({
    id: `${a}-${b}`, source: a, target: b, type: 'smoothstep',
    style: { stroke: '#abbdb9', strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#abbdb9', width: 12, height: 12 },
  }))
  // 全部坐标保存在同一份状态里；隐藏节点不渲染，展开后仍保留拖动过的位置。
  useEffect(() => {
    if (!flow) return
    // 等节点测量完成再居中，否则窄屏首次打开时可能停在 100% 缩放并裁掉节点。
    const timer = window.setTimeout(() => flow.fitView({ padding: .2, duration: 250 }), 180)
    return () => window.clearTimeout(timer)
  }, [flow, visible])

  function select(id: string) {
    setSelected(id)
    setVisible(current => [...new Set([...current, ...graphLinks.flatMap(([a, b]) => a === id ? [b] : b === id ? [a] : [])])])
  }

  return <main className="page-shell graph-page">
    <div className="eyebrow">SCAM GRAPH / 骗局图谱</div>
    <div className="page-heading"><div><h1>骗局的名字会变，<br />但套路往往不会。</h1><p>从共同的行为模式出发，看看不同骗局如何连接在一起。点击节点，沿线索继续展开。</p></div><span className="page-count">{visible.length} 个节点已显示 · 持续补充</span></div>
    <div className="graph-layout">
      <section className="graph-canvas" aria-label="可拖动和缩放的骗局关系图">
        <ReactFlow nodes={graphNodes} edges={graphEdges} onNodesChange={onNodesChange} onNodeClick={(_, node) => select(node.id)} onInit={setFlow} fitView fitViewOptions={{ padding: .25 }} minZoom={.15} maxZoom={1.8} proOptions={{ hideAttribution: true }}>
          <Background color="#dce5e2" gap={22} size={1} /><Controls showInteractive={false} />
        </ReactFlow>
        <div className="graph-hint">拖动节点 · 滚轮缩放 · 点击展开</div>
      </section>
      <aside className="graph-detail"><div className="detail-kicker">当前节点 / {selectedItem.kind === 'core' ? '核心机制' : '具体表现'}</div><h2>{selected}</h2><p>{selectedItem.description}</p><div className="detail-divider" /><h3>它可能连接到</h3><div className="node-tags">{graphLinks.flatMap(([a, b]) => a === selected ? [b] : b === selected ? [a] : []).map(id => <button key={id} onClick={() => select(id)}>{id} ↗</button>)}</div><h3>相关案例</h3>{related.length ? related.map(item => <Link className="related-link" to={`/cases/${item.id}`} key={item.id}>{item.title}<span>↗</span></Link>) : <p className="muted">继续展开节点，查看更多案例。</p>}</aside>
    </div>
  </main>
}
