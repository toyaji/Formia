
import { useState, useMemo, useEffect } from 'react';
import { useFormStore } from '@/store/useFormStore';
import styles from './Sidebar.module.css';
import { FormBlock, FormPage, BlockType } from '@/lib/core/schema';
import { BLOCK_METADATA } from '@/lib/constants/blocks';
import { ReviewFormPage } from '@/lib/utils/patchUtils';
import { Plus, Trash2, GripVertical, ChevronDown, ChevronRight, Check, X, Copy, MoreHorizontal } from 'lucide-react';
import { generateQuestionPageTitle, generateEndingPageTitle } from '@/lib/utils/pageUtils';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

export const Sidebar = () => {
  const { 
    formFactor, activePageId, activeBlockId, 
    setActivePageId, setActiveBlockId, applyJsonPatch,
    isReviewMode, preReviewSnapshot, pendingPatches,
    getReviewViewModel
  } = useFormStore();
  
  // Accordion state: map of pageId -> boolean (true = expanded)
  const [expandedPages, setExpandedPages] = useState<Record<string, boolean>>({});
  
  // Inline editing state: editingPageId
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  // Compute pages to render (Normal vs Review)
  // We need to enable `getReviewPages` only when isReviewMode is true AND we have a snapshot
  const allPages = useMemo(() => {
    if (isReviewMode) {
      return getReviewViewModel();
    }
    if (!formFactor) return [] as ReviewFormPage[];

    const result: ReviewFormPage[] = [];
    if (formFactor.pages.start) {
      result.push({ 
        ...formFactor.pages.start, 
        reviewMetadata: { status: 'kept' as const },
        blocks: formFactor.pages.start.blocks.map(b => ({ ...b, reviewMetadata: { status: 'kept' as const } }))
      });
    }
    formFactor.pages.questions.forEach(p => {
      result.push({ 
        ...p, 
        reviewMetadata: { status: 'kept' as const },
        blocks: p.blocks.map(b => ({ ...b, reviewMetadata: { status: 'kept' as const } }))
      });
    });
    formFactor.pages.endings?.forEach((p: FormPage) => {
      result.push({ 
        ...p, 
        reviewMetadata: { status: 'kept' as const },
        blocks: p.blocks.map(b => ({ ...b, reviewMetadata: { status: 'kept' as const } }))
      });
    });
    // Fallback for legacy data if endings array doesn't exist but ending object does
    if (!formFactor.pages.endings && (formFactor.pages as any).ending) {
        const p = (formFactor.pages as any).ending;
        result.push({
            ...p,
            reviewMetadata: { status: 'kept' as const },
            blocks: p.blocks.map((b: any) => ({ ...b, reviewMetadata: { status: 'kept' as const } }))
        });
    }
    return result;
  }, [isReviewMode, getReviewViewModel, formFactor]);

  // Initialize expanded state
  useEffect(() => {
    if (activePageId && expandedPages[activePageId] === undefined) {
      setExpandedPages(prev => ({ ...prev, [activePageId]: true }));
    }
  }, [activePageId, expandedPages]);

  const togglePage = (e: React.MouseEvent, pageId: string) => {
    e.stopPropagation();
    setExpandedPages(prev => ({
      ...prev,
      [pageId]: !(prev[pageId] ?? true) // Default to true if undefined
    }));
  };

  const startPage = useMemo(() => 
    allPages.find((p: ReviewFormPage) => p.type === 'start'), 
    [allPages]
  );
  
  const questionPages = useMemo(() => 
    allPages.filter((p: ReviewFormPage) => p.type !== 'start' && p.type !== 'ending'), 
    [allPages]
  );

  const endingPages = useMemo(() => 
    allPages.filter((p: ReviewFormPage) => p.type === 'ending'), 
    [allPages]
  );
  
  // Helper to find page section and index
  const getPagePathInfo = (pageId: string) => {
    if (!formFactor) return null;
    if (formFactor.pages.start?.id === pageId) return { section: 'start', path: '/pages/start' };
    
    const eIdx = formFactor.pages.endings.findIndex(p => p.id === pageId);
    if (eIdx !== -1) return { section: 'ending', path: `/pages/endings/${eIdx}` };

    const qIdx = formFactor.pages.questions.findIndex(p => p.id === pageId);
    if (qIdx !== -1) return { section: 'questions', index: qIdx, path: `/pages/questions/${qIdx}` };
    return null;
  };

  const getGlobalPageIndex = (pageId: string) => {
    return allPages.findIndex(p => p.id === pageId);
  };

  const onDragEnd = (result: DropResult) => {
    // Disable reordering in review mode to avoid complex index mapping
    if (isReviewMode) return;

    const { source, destination, type } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    if (type === 'PAGE') {
      // Reordering pages within the same section (Question Only for now)
      if (source.droppableId !== 'questions-list') return;
      
      applyJsonPatch([{
        op: 'move',
        from: `/pages/questions/${source.index}`,
        path: `/pages/questions/${destination.index}`
      }]);

    } else {
      // Reordering blocks
      const sourcePageId = source.droppableId.replace('page-blocks-', '');
      const destPageId = destination.droppableId.replace('page-blocks-', '');
      
      const sourceInfo = getPagePathInfo(sourcePageId);
      const destInfo = getPagePathInfo(destPageId);

      if (sourceInfo && destInfo) {
        applyJsonPatch([{
          op: 'move',
          from: `${sourceInfo.path}/blocks/${source.index}`,
          path: `${destInfo.path}/blocks/${destination.index}`
        }]);
      }
    }
  };

  const addQuestionPage = () => {
    const count = questionPages.length;
    applyJsonPatch([{
      op: 'add',
      path: '/pages/questions/-',
      value: { 
        id: Math.random().toString(36).substring(7), 
        type: 'default',
        title: generateQuestionPageTitle(count), 
        blocks: [] 
      }
    }]);
  };
  
  const addEndingPage = () => {
    if (!formFactor) return;
    const count = endingPages.length;
    applyJsonPatch([{
      op: 'add',
      path: '/pages/endings/-',
      value: { 
        id: Math.random().toString(36).substring(7), 
        type: 'ending',
        title: generateEndingPageTitle(count), 
        blocks: [
            {
                id: Math.random().toString(36).substring(7),
                type: 'statement',
                removable: false,
                content: {
                  label: '제출이 완료되었습니다.',
                  body: '답변해 주셔서 감사합니다.'
                }
            }
        ] 
      }
    }]);
  };

  const deletePage = (e: React.MouseEvent, pageId: string) => {
    e.stopPropagation();
    
    const info = getPagePathInfo(pageId);
    if (!info) return;

    if (info.section === 'start') {
        alert('시작 페이지는 삭제할 수 없습니다.');
        return;
    }

    if (info.section === 'ending') {
        if (endingPages.length <= 1) {
            alert('최소 하나의 종료 페이지는 유지되어야 합니다.');
            return;
        }
    }

    applyJsonPatch([{ op: 'remove', path: info.path }]);
  };

  const addBlock = (e: React.MouseEvent, pageId: string) => {
    e.stopPropagation();
    const info = getPagePathInfo(pageId);
    if (info) {
      const isEnding = info.section === 'ending';
      setExpandedPages(prev => ({ ...prev, [pageId]: true }));
      
      applyJsonPatch([{
        op: 'add',
        path: `${info.path}/blocks/-`,
        value: {
          id: Math.random().toString(36).substring(7),
          type: isEnding ? 'info' : 'text',
          content: { 
            label: isEnding ? '안내 문구' : '새로운 질문',
            ...(isEnding ? { body: '감사합니다. 제출이 완료되었습니다.' } : {})
          }
        }
      }]);
    }
  };

  const deleteBlock = (e: React.MouseEvent, pageId: string, blockIndex: number) => {
    e.stopPropagation();
    const info = getPagePathInfo(pageId);
    if (info) {
      applyJsonPatch([{
        op: 'remove',
        path: `${info.path}/blocks/${blockIndex}`
      }]);
    }
  };

  const duplicateBlock = (e: React.MouseEvent, pageId: string, block: FormBlock) => {
    e.stopPropagation();
    const info = getPagePathInfo(pageId);
    if (info) {
      const newBlock = { ...block, id: Math.random().toString(36).substring(7) };
      applyJsonPatch([{
        op: 'add',
        path: `${info.path}/blocks/-`,
        value: newBlock
      }]);
    }
  };

  const handleTitleSubmit = (pageId: string) => {
    if (!editTitle.trim()) {
      setEditingPageId(null);
      return;
    }
    
    const info = getPagePathInfo(pageId);
    if (info) {
      applyJsonPatch([{
        op: 'replace',
        path: `${info.path}/title`,
        value: editTitle.trim()
      }]);
    }
    setEditingPageId(null);
  };

  // Render a Page Item (Draggable)
  const renderPageItem = (pageBase: FormPage | ReviewFormPage, index: number, isEnding: boolean, isStart: boolean) => {
    const page = pageBase as ReviewFormPage;
    const isActive = activePageId === page.id;
    const isExpanded = expandedPages[page.id] ?? true; // Default to expanded
    // Can delete if it's an ending page AND there's more than 1 OR if it's a question page. Start page NEVER deletable.
    const canDelete = page.removable !== false && (isStart ? false : (isEnding ? endingPages.length > 1 : true));
    
    const isRemoved = page.reviewMetadata.status === 'removed';
    const isAdded = page.reviewMetadata.status === 'added';
    
    // Style adjustments
    const containerStyle: React.CSSProperties = {
        opacity: isRemoved ? 0.5 : 1,
        pointerEvents: isRemoved ? 'none' : 'auto',
        textDecoration: isRemoved ? 'line-through' : 'none',
    };
    
    // Label Logic
    const isPrimaryEnding = isEnding && allPages.findIndex((p: ReviewFormPage) => p.type === 'ending') === index;
    const isImmutable = isStart || isPrimaryEnding;
    const pageLabel = page.title;

    const renderLabel = () => {
      if (editingPageId === page.id) {
        return (
          <input
            autoFocus
            className={styles.titleInput}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={() => handleTitleSubmit(page.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTitleSubmit(page.id);
              if (e.key === 'Escape') setEditingPageId(null);
            }}
            onClick={(e) => e.stopPropagation()}
          />
        );
      }
      return (
        <span 
          className={styles.pageLabel}
          onDoubleClick={(e) => {
            if (isImmutable) return;
            e.stopPropagation();
            setEditingPageId(page.id);
            setEditTitle(page.title || '');
          }}
        >
          {pageLabel}
        </span>
      );
    };

    const content = (
      <div 
        className={`${styles.pageHeader} ${isActive ? styles.active : ''}`}
        onClick={() => setActivePageId(page.id)}
      >
        {/* Accordion Toggle */}
        <div 
          className={`${styles.toggleBtn} ${!isExpanded ? styles.collapsed : ''}`}
          onClick={(e) => togglePage(e, page.id)}
          role="button"
        >
          <ChevronDown size={14} />
        </div>

        {/* Drag Handle (Questions only) */}
        {!isEnding && !isStart && (
          <div className={`${styles.dragHandle} drag-handle`}>
            <GripVertical size={14} />
          </div>
        )}
        
        {renderLabel()}
        
        {/* Hover Actions */}
        <div className={styles.pageActions}>
          {/* Allow adding blocks to Start Page and Question Pages. NOT Ending Pages (for now, or handled separately) */}
          {!isEnding && (
             <button 
               className={styles.actionBtn} 
               onClick={(e) => addBlock(e, page.id)}
               title="질문 추가"
             >
               <Plus size={14} />
             </button>
          )}
          {canDelete && (
            <button 
              className={styles.actionBtn} 
              onClick={(e) => deletePage(e, page.id)}
              title="페이지 삭제"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    );

    const blocksList = (
      <div className={`${styles.blockList} ${!isExpanded ? styles.collapsed : ''}`}>
        {isReviewMode ? (
          <div style={{ minHeight: '10px' }}>
            {page.blocks.map((block: any, bIndex: number) => {
              const bIsRemoved = block.reviewMetadata?.status === 'removed';
              return (
                <div 
                  key={block.id}
                  className={styles.blockItem}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!bIsRemoved) {
                      setActivePageId(page.id);
                      setActiveBlockId(block.id);
                    }
                  }}
                  style={{
                      backgroundColor: activeBlockId === block.id ? 'rgba(59, 130, 246, 0.1)' : undefined,
                      opacity: bIsRemoved ? 0.5 : 1,
                      textDecoration: bIsRemoved ? 'line-through' : 'none',
                      pointerEvents: bIsRemoved ? 'none' : 'auto'
                  }}
                >
                  <span className={styles.blockIcon}>
                    {BLOCK_METADATA[block.type as BlockType]?.icon || block.type[0].toUpperCase()}
                  </span>
                  <span className={styles.blockLabel}>
                    {block.content.label || BLOCK_METADATA[block.type as BlockType]?.label || block.type}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <Droppable droppableId={`page-blocks-${page.id}`} type="BLOCK">
            {(provided) => (
              <div 
                ref={provided.innerRef}
                {...provided.droppableProps}
                style={{ minHeight: '10px' }} 
              >
                {page.blocks.map((block: FormBlock, bIndex: number) => (
                  <Draggable key={block.id} draggableId={block.id} index={bIndex}>
                    {(provided, snapshot) => (
                      <div 
                        className={styles.blockItem}
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActivePageId(page.id);
                          setActiveBlockId(block.id);
                        }}
                        style={{
                            ...provided.draggableProps.style,
                            backgroundColor: activeBlockId === block.id ? 'rgba(59, 130, 246, 0.1)' : undefined
                        }}
                      >
                        <span className={styles.blockIcon}>
                          {BLOCK_METADATA[block.type]?.icon || block.type[0].toUpperCase()}
                        </span>
                        <span className={styles.blockLabel}>
                          {block.content.label || BLOCK_METADATA[block.type]?.label || block.type}
                        </span>
                        
                        <div className={styles.blockActions}>
                          <button 
                            className={styles.actionBtn}
                            onClick={(e) => duplicateBlock(e, page.id, block)}
                            title="복제"
                          >
                            <Copy size={12} />
                          </button>
                          {block.removable !== false && (
                            <button 
                              className={styles.actionBtn}
                              onClick={(e) => deleteBlock(e, page.id, bIndex)}
                              title="삭제"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        )}
      </div>
    );

    const isPageDraggable = !isStart && !isEnding && !isReviewMode;

    const renderHeader = (dragHandleProps: any = {}) => (
      <div 
        className={`${styles.pageHeader} ${isActive ? styles.active : ''} ${isPageDraggable ? styles.draggable : ''}`}
        onClick={() => setActivePageId(page.id)}
        {...dragHandleProps}
      >
        {/* Accordion Toggle */}
        <div 
          className={`${styles.toggleBtn} ${!isExpanded ? styles.collapsed : ''}`}
          onClick={(e) => togglePage(e, page.id)}
          role="button"
        >
          <ChevronDown size={14} />
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
            {renderLabel()}
            {isAdded && <span style={{ fontSize: '0.7em', color: '#22C55E' }}>(New)</span>}
            {isRemoved && <span style={{ fontSize: '0.7em', color: '#EF4444' }}>(Deleted)</span>}
        </div>
        
        {/* Hover Actions */}
        <div className={styles.pageActions}>
          {!isEnding && (
            <button 
              className={styles.actionBtn} 
              onClick={(e) => addBlock(e, page.id)}
              title="질문 추가"
            >
              <Plus size={14} />
            </button>
          )}
          {canDelete && (
            <button 
              className={styles.actionBtn} 
              onClick={(e) => deletePage(e, page.id)}
              title="페이지 삭제"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    );

    const pageContent = (
       <div 
          className={styles.pageGroup}
          style={containerStyle}
        >
          {isPageDraggable ? null : renderHeader()}
          {/* Blocks List (Accordion Content) */}
          {blocksList}
        </div>
    );

    // If it's a fixed page or review mode, don't wrap in Draggable
    if (!isPageDraggable) {
       return (
         <div key={page.id}>
            {pageContent}
         </div>
       );
    }

    return (
      <Draggable key={page.id} draggableId={page.id} index={index}> 
        {(provided, snapshot) => (
          <div 
            className={`${styles.pageGroup} ${snapshot.isDragging ? styles.dragging : ''}`}
            ref={provided.innerRef}
            {...provided.draggableProps}
            style={{ 
              ...containerStyle,
              ...provided.draggableProps.style 
            }}
          >
            {renderHeader(provided.dragHandleProps)}
            {blocksList}
          </div>
        )}
      </Draggable>
    );
  };

  return (
    <div className={styles.sidebarContent}>
      
      {/* Scrollable Area */}
      <div className={styles.scrollArea}>
        <DragDropContext onDragEnd={onDragEnd}>
          
          {/* Combined Start and Question Pages Section */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span>질문 페이지</span>
              <button 
                className={styles.addBtn} 
                onClick={addQuestionPage} 
                title="새 페이지 추가"
              >
                <Plus size={14} />
              </button>
            </div>
            
            {/* Start Page (Fixed) */}
            <div className={styles.pageList}>
               {startPage && renderPageItem(startPage, 0, false, true)}
            </div>

            {/* Question Pages (Draggable) */}
            <Droppable droppableId="questions-list" type="PAGE">
              {(provided) => (
                <div 
                  className={styles.pageList}
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                >
                  {questionPages.map((page: ReviewFormPage, index: number) => renderPageItem(page, index, false, false))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
            
          </div>

          {/* Section: Endings (Separator? Or just listed) */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span>종료 페이지</span>
              {/* Optional: Add button for ending pages if needed, but user didn't explicitly remove it. 
                  Keeping it for now as "Ending Page" might be separate. 
                  User said "Page Add button above Ending Page area". 
                  This implies Ending Page area still exists. */}
              <button 
                className={styles.addBtn} 
                onClick={addEndingPage} 
                title="종료 페이지 추가"
              >
                <Plus size={14} />
              </button>
            </div>
             
             <Droppable droppableId="endings-list" type="PAGE" isDropDisabled={true}>
               {(provided) => (
                 <div 
                   className={styles.pageList}
                   ref={provided.innerRef}
                   {...provided.droppableProps}
                 >
                   {endingPages.map((page, index) => renderPageItem(page, index, true, false))}
                   {provided.placeholder}
                 </div>
               )}
             </Droppable>
          </div>

        </DragDropContext>
      </div>
    </div>
  );
};
