import { useEffect, useMemo, useState } from 'react'
import { ReactFlow, Background, Controls, MarkerType, useNodesState, type Edge, type Node, type ReactFlowInstance } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Link, useLocation } from 'react-router-dom'
import { cases } from './data/cases'
import { graphItems, graphLinks } from './data/graph'
import { loadCases } from './caseStore'
import { sourceLabel } from './schema'

const core = graphItems.filter(item => item.kind === 'core').map(item => item.id)
const allNodes: Node[] = graphItems.map(item => ({
  id: item.id, position: { x: item.x, y: item.y }, data: { label: item.id },
  className: `graph-node ${item.kind}`,
}))

export default function GraphPage() {
  const location = useLocation()
  const query = new URLSearchParams(location.search)
  const record = query.get('case') ? loadCases().find(item => item.id === query.get('case')) : undefined
  const requested = record?.analysis?.graphNodes || query.get('nodes')?.split(',').filter(Boolean) || []
  const missingNodes = requested.filter(id => !graphItems.some(item => item.id === id))
  const highlighted = useMemo(() => {
    const names = record?.analysis?.graphNodes || query.get('nodes')?.split(',') || []
    return new Set(names.filter(id => graphItems.some(item => item.id === id)))
  }, [record?.id, location.search])
  const highlightKey = [...highlighted].join(',')
  const [visible, setVisible] = useState<string[]>(() => [...new Set([...core, ...highlighted])])
  const [selected, setSelected] = useState(() => [...highlighted][0] || '利益诱导')
  const [flow, setFlow] = useState<ReactFlowInstance | null>(null)
  const selectedItem = graphItems.find(item => item.id === selected) || graphItems[0]
  const related = cases.filter(item => item.nodes.includes(selected)).slice(0, 3)
  const visibleSet = useMemo(() => new Set(visible), [visible])
  const [nodes, , onNodesChange] = useNodesState(allNodes)
  const graphNodes = nodes.filter(item => visibleSet.has(item.id)).map(item => ({ ...item, className: `${item.className || ''} ${highlighted.size ? highlighted.has(item.id) ? 'highlighted' : 'dimmed' : ''} ${selected === item.id ? 'selected' : ''}` }))
  const graphEdges: Edge[] = graphLinks.filter(([a, b]) => visibleSet.has(a) && visibleSet.has(b)).map(([a, b]) => ({
    id: `${a}-${b}`, source: a, target: b, type: 'smoothstep',
    // 只有两个端点都与当前事件有关，才把这条关系作为案件路径突出显示。
    style: { stroke: highlighted.size && highlighted.has(a) && highlighted.has(b) ? '#bf7756' : '#abbdb9', strokeWidth: highlighted.size && highlighted.has(a) && highlighted.has(b) ? 3 : 1.5, opacity: highlighted.size && !(highlighted.has(a) && highlighted.has(b)) ? .25 : 1 }, markerEnd: { type: MarkerType.ArrowClosed, color: highlighted.has(a) && highlighted.has(b) ? '#bf7756' : '#abbdb9', width: 12, height: 12 },
  }))
  useEffect(() => {
    if (!highlightKey) return
    setVisible(current => [...new Set([...current, ...highlighted])])
    setSelected([...highlighted][0])
  }, [highlightKey])
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
    {query.get('case') && !record && <p className="graph-warning" role="status">未找到对应案件，已显示基础图谱。请返回案件中心确认本地记录。</p>}
    {missingNodes.length > 0 && <p className="graph-warning" role="status">{missingNodes.length} 个关联节点暂不存在，已显示可用节点。</p>}
    {highlighted.size > 0 && <div className="graph-context"><div><strong>{record ? `${record.title}的相关路径` : '本次分析的相关路径'}</strong><span>高亮来自描述中的行为线索，不代表对个人或商家的定性。</span></div>{record ? <Link to={`/my-cases/${record.id}`}>返回案件 ↗</Link> : <Link to="/graph">清除高亮 ↗</Link>}</div>}
    <div className="graph-layout">
      <section className="graph-canvas" aria-label="可拖动和缩放的骗局关系图">
        <ReactFlow nodes={graphNodes} edges={graphEdges} onNodesChange={onNodesChange} onNodeClick={(_, node) => select(node.id)} onInit={setFlow} fitView fitViewOptions={{ padding: .25 }} minZoom={.15} maxZoom={1.8} proOptions={{ hideAttribution: true }}>
          <Background color="#dce5e2" gap={22} size={1} /><Controls showInteractive={false} />
        </ReactFlow>
        <div className="graph-hint">拖动节点 · 滚轮缩放 · 点击展开</div>
      </section>
      <aside className="graph-detail"><div className="detail-kicker">当前节点 / {selectedItem.kind === 'core' ? '核心机制' : '具体表现'}</div><h2>{selectedItem.id}</h2><p>{selectedItem.description}</p><p className="source-caption">{sourceLabel(selectedItem)} · 更新于 {selectedItem.updatedAt}</p><div className="detail-divider" /><h3>它可能连接到</h3><div className="node-tags">{graphLinks.flatMap(([a, b]) => a === selectedItem.id ? [b] : b === selectedItem.id ? [a] : []).map(id => <button key={id} onClick={() => select(id)}>{id} ↗</button>)}</div><h3>相关案例</h3>{related.length ? related.map(item => <Link className="related-link" to={`/cases/${item.id}`} key={item.id}>{item.title}<span>↗</span></Link>) : <p className="muted">继续展开节点，查看更多案例。</p>}</aside>
    </div>
  </main>
}
