

import React, { useRef, useState } from 'react';
import { Button, Input, Select } from 'antd';
import './App.css';

type ShapeType = 'rectangle' | 'circle' | 'line';
type LineStyle = 'solid' | 'dashed';

interface DrawingElement {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  background: string;
  lineStyle: LineStyle;
  lineWidth: number;
  selected: boolean;
  x2?: number;
  y2?: number;
}

const defaultAppearance = {
  color: '#000000',
  background: '#ffffff',
  lineStyle: 'solid' as LineStyle,
  lineWidth: 2,
};

function App() {
  const [elements, setElements] = useState<DrawingElement[]>([]);
  const [currentShape, setCurrentShape] = useState<ShapeType>('rectangle');
  const [drawing, setDrawing] = useState(false);
  const [appearance, setAppearance] = useState(defaultAppearance);
  const [dragId, setDragId] = useState<string | null>(null);
  const [offset, setOffset] = useState<{x: number, y: number}>({x: 0, y: 0});
  const canvasRef = useRef<HTMLDivElement>(null);

  // Start drawing
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target !== canvasRef.current) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (currentShape === 'line') {
      setElements([...elements, {
        id: Date.now().toString(),
        type: 'line',
        x, y, x2: x, y2: y,
        width: 0, height: 0,
        color: appearance.color,
        background: appearance.background,
        lineStyle: appearance.lineStyle,
        lineWidth: appearance.lineWidth,
        selected: false,
      }]);
    } else {
      setElements([...elements, {
        id: Date.now().toString(),
        type: currentShape,
        x, y,
        width: 0, height: 0,
        color: appearance.color,
        background: appearance.background,
        lineStyle: appearance.lineStyle,
        lineWidth: appearance.lineWidth,
        selected: false,
      }]);
    }
    setDrawing(true);
  };

  // Drawing in progress
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;
  const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drawing) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    x = clamp(x, 0, CANVAS_WIDTH);
    y = clamp(y, 0, CANVAS_HEIGHT);
    setElements(prev => {
      const last = prev[prev.length - 1];
      if (!last) return prev;
      if (last.type === 'line') {
        // Keep start point fixed, only clamp end point
        const x2 = clamp(x, 0, CANVAS_WIDTH);
        const y2 = clamp(y, 0, CANVAS_HEIGHT);
        return [...prev.slice(0, -1), { ...last, x2, y2 }];
      } else if (last.type === 'circle') {
        // Clamp width and height so bounding box stays inside canvas
        let width = x - last.x;
        let height = y - last.y;
        // Clamp right/bottom edge
        if (last.x + width > CANVAS_WIDTH) width = CANVAS_WIDTH - last.x;
        if (last.y + height > CANVAS_HEIGHT) height = CANVAS_HEIGHT - last.y;
        // Clamp left/top edge
        if (last.x + width < 0) width = -last.x;
        if (last.y + height < 0) height = -last.y;
        return [...prev.slice(0, -1), { ...last, width, height }];
      } else {
        // Rectangle logic (already clamps correctly)
        const width = clamp(x - last.x, -last.x, CANVAS_WIDTH - last.x);
        const height = clamp(y - last.y, -last.y, CANVAS_HEIGHT - last.y);
        return [...prev.slice(0, -1), { ...last, width, height }];
      }
    });
  };

  // Finish drawing
  const handleMouseUp = () => {
    setDrawing(false);
  };

  // Select element
  const handleSelect = (id: string) => {
    setElements(prev => prev.map(el => ({ ...el, selected: el.id === id })));
  };

  // Drag start
  const handleDragStart = (e: React.MouseEvent, id: string) => {
    const el = elements.find(el => el.id === id);
    if (!el) return;
    setDragId(id);
    setOffset({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });
  };

  // Drag move
  const handleDragMove = (e: React.MouseEvent) => {
    if (!dragId) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    let x = e.clientX - rect.left - offset.x;
    let y = e.clientY - rect.top - offset.y;
    // Clamp position so shape stays inside canvas, but do not change width/height
    setElements(prev => prev.map(el => {
      if (el.id !== dragId) return el;
      // Clamp position so the entire shape stays visible, always use absolute width/height
      let newX = x;
      let newY = y;
      if (el.type !== 'line') {
        const w = el.width;
        const h = el.height;
        // For positive width, clamp so right edge stays inside
        // For negative width, clamp so left edge stays inside
        if (w >= 0) {
          newX = clamp(x, 0, CANVAS_WIDTH - w);
        } else {
          newX = clamp(x, 0, CANVAS_WIDTH);
          if (newX + w < 0) newX = -w;
        }
        if (h >= 0) {
          newY = clamp(y, 0, CANVAS_HEIGHT - h);
        } else {
          newY = clamp(y, 0, CANVAS_HEIGHT);
          if (newY + h < 0) newY = -h;
        }
      } else {
        newX = clamp(x, 0, CANVAS_WIDTH);
        newY = clamp(y, 0, CANVAS_HEIGHT);
      }
      const newEl = { ...el, x: newX, y: newY };
      if (el.type === 'line' && el.x2 !== undefined && el.y2 !== undefined) {
        const dx = newX - el.x;
        const dy = newY - el.y;
        // Clamp both endpoints inside canvas
        let newX2 = clamp(el.x2 + dx, 0, CANVAS_WIDTH);
        let newY2 = clamp(el.y2 + dy, 0, CANVAS_HEIGHT);
        // If moving would push line out, adjust position so both endpoints stay inside
        if (newX2 < 0) {
          newX2 = 0;
          newX = clamp(newX + (0 - (el.x2 + dx)), 0, CANVAS_WIDTH);
        } else if (newX2 > CANVAS_WIDTH) {
          newX2 = CANVAS_WIDTH;
          newX = clamp(newX + (CANVAS_WIDTH - (el.x2 + dx)), 0, CANVAS_WIDTH);
        }
        if (newY2 < 0) {
          newY2 = 0;
          newY = clamp(newY + (0 - (el.y2 + dy)), 0, CANVAS_HEIGHT);
        } else if (newY2 > CANVAS_HEIGHT) {
          newY2 = CANVAS_HEIGHT;
          newY = clamp(newY + (CANVAS_HEIGHT - (el.y2 + dy)), 0, CANVAS_HEIGHT);
        }
        newEl.x = newX;
        newEl.y = newY;
        newEl.x2 = newX2;
        newEl.y2 = newY2;
      }
      // Do NOT clamp width/height here; keep original size
      return newEl;
    }));
  };

  // Drag end
  const handleDragEnd = () => {
    setDragId(null);
  };

  // Change appearance
  const handleAppearanceChange = (field: keyof typeof defaultAppearance, value: string | number) => {
    setAppearance(prev => ({ ...prev, [field]: value }));
    setElements(prev => prev.map(el => el.selected ? { ...el, [field]: value } : el));
  };

  // Save drawing
  const handleSave = () => {
    localStorage.setItem('drawing', JSON.stringify(elements));
    alert('Drawing saved!');
  };

  // Load drawing
  const handleLoad = () => {
    const data = localStorage.getItem('drawing');
    if (data) setElements(JSON.parse(data));
  };

  // Toolbar
  const Toolbar = () => (
    <div className="toolbar" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
      <Select
        value={currentShape}
        onChange={value => setCurrentShape(value as ShapeType)}
        style={{ width: 120 }}
        options={[
          { value: 'rectangle', label: 'Rectangle' },
          { value: 'circle', label: 'Circle' },
          { value: 'line', label: 'Line' },
        ]}
      />
      <input type="color" value={appearance.color} onChange={e => handleAppearanceChange('color', e.target.value)} title="Line Color" />
      <input type="color" value={appearance.background} onChange={e => handleAppearanceChange('background', e.target.value)} title="Background Color" />
      <Select
        value={appearance.lineStyle}
        onChange={value => handleAppearanceChange('lineStyle', value)}
        style={{ width: 120 }}
        options={[
          { value: 'solid', label: 'Solid' },
          { value: 'dashed', label: 'Dashed' },
        ]}
      />
      <Input
        type="number"
        min={1}
        max={10}
        value={appearance.lineWidth}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleAppearanceChange('lineWidth', Number(e.target.value))}
        style={{ width: 80 }}
        placeholder="Line Width"
      />
      <Button type="primary" onClick={handleSave}>Save</Button>
      <Button onClick={handleLoad}>Load</Button>
    </div>
  );

  // Render elements
  const renderElement = (el: DrawingElement) => {
    // Assign zIndex based on order in elements array
    const idx = elements.findIndex(e => e.id === el.id);
    const common = {
      key: el.id,
      className: `shape${el.selected ? ' selected' : ''}`,
      style: {
        position: 'absolute' as const,
        left: el.x,
        top: el.y,
        cursor: 'pointer',
        border: el.selected ? '2px solid #007bff' : 'none',
        boxSizing: 'border-box' as const,
        transition: 'box-shadow 0.2s, border 0.2s',
        zIndex: idx + 1,
      },
      onClick: (e: React.MouseEvent) => { e.stopPropagation(); handleSelect(el.id); },
      onMouseDown: (e: React.MouseEvent) => handleDragStart(e, el.id),
      onMouseMove: handleDragMove,
      onMouseUp: handleDragEnd,
    };
    if (el.type === 'rectangle') {
      return <div {...common} style={{ ...common.style, width: Math.abs(el.width), height: Math.abs(el.height), background: el.background, border: `${el.lineWidth}px ${el.lineStyle} ${el.color}` }} />;
    }
    if (el.type === 'circle') {
      return <div {...common} style={{ ...common.style, width: Math.abs(el.width), height: Math.abs(el.height), background: el.background, border: `${el.lineWidth}px ${el.lineStyle} ${el.color}`, borderRadius: '50%' }} />;
    }
    if (el.type === 'line') {
      const x1 = el.x, y1 = el.y, x2 = el.x2 ?? el.x, y2 = el.y2 ?? el.y;
      const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
      const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
      return <div {...common} style={{ ...common.style, width: length, height: el.lineWidth, background: el.color, left: x1, top: y1, transform: `rotate(${angle}deg)`, borderRadius: '2px', border: el.lineStyle === 'dashed' ? `${el.lineWidth}px dashed ${el.color}` : 'none' }} />;
    }
    return null;
  };

  return (
    <div className="app">
      <h2>Drawing App</h2>
      <Toolbar />
      <div
        ref={canvasRef}
        className="canvas"
        style={{ position: 'relative', width: CANVAS_WIDTH, height: CANVAS_HEIGHT, border: '1px solid #ccc', margin: '20px auto', background: '#f9f9f9', overflow: 'hidden' }}
        onMouseDown={handleMouseDown}
        onMouseMove={drawing ? handleMouseMove : dragId ? handleDragMove : undefined}
        onMouseUp={drawing ? handleMouseUp : dragId ? handleDragEnd : undefined}
      >
        {elements.map(renderElement)}
      </div>
    </div>
  );
}

export default App;
