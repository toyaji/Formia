
import { useState, useMemo, useEffect } from 'react';
import { useFormStore } from '@/store/useFormStore';
import styles from './Sidebar.module.css';
import { FormBlock, FormPage } from '@/lib/core/schema';
import { getReviewPages, ReviewFormPage } from '@/lib/utils/patchUtils';
import { Plus, Trash2, GripVertical, ChevronDown, ChevronRight, Check, X, Copy, MoreHorizontal } from 'lucide-react';
import { generateQuestionPageTitle, generateEndingPageTitle } from '@/lib/utils/pageUtils';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

export const Sidebar = () => {
  const { 
    formFactor, activePageId, activeBlockId, 
    setActivePageId, setActiveBlockId, applyJsonPatch,
    isReviewMode, preReviewSnapshot, pendingPatches // Get snapshot and pending patches
  } = useFormStore();
  
  // Accordion state: map of pageId -> boolean (true = expanded)
  const [expandedPages, setExpandedPages] = useState<Record<string, boolean>>({});
  
  // Inline editing state: editingPageId
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  // Compute pages to render (Normal vs Review)
  // We need to enable `getReviewPages` only when isReviewMode is true AND we have a snapshot
  const allPages = useMemo(() => {
    if (isReviewMode && preReviewSnapshot && formFactor) {
      return getReviewPages(preReviewSnapshot.pages, formFactor.pages, pendingPatches);
    }
    return (formFactor?.pages || []).map(p => ({ ...p, reviewStatus: 'kept' as const }));
  }, [isReviewMode, preReviewSnapshot, formFactor, pendingPatches]);

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
    allPages.find(p => p.type === 'start'), 
    [allPages]
  );
  
  const questionPages = useMemo(() => 
    allPages.filter(p => !p.type || p.type === 'default'), 
    [allPages]
  );

  const endingPages = useMemo(() => 
    allPages.filter(p => p.type === 'ending'), 
    [allPages]
  );
  
  // Helper to find global index
  const getGlobalPageIndex = (pageId: string) => 
    formFactor?.pages.findIndex(p => p.id === pageId) ?? -1;

  const onDragEnd = (result: DropResult) => {
    const { source, destination, type } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    if (type === 'PAGE') {
      // Logic for reordering pages within the same section (Question Only for now)
      // Getting real indices needs care if we split lists. 
      // Simplified: We drag by index in the *source list*.
      // We need to map these back to global indices.
      
      const sourcePage = questionPages[source.index];
      const destPage = questionPages[destination.index];
      
      if (!sourcePage || !destPage) return; // Should not happen if dropping in same list
      
      const fromIndex = getGlobalPageIndex(sourcePage.id);
      
      // Calculate toIndex. If moving down, we want to be after the dest page.
      // But applyJsonPatch 'move' is standard array manipulation.
      // We can use the destination's global index as reference.
      let toIndex = getGlobalPageIndex(destPage.id);
      
      applyJsonPatch([{
        op: 'move',
        from: `/pages/${fromIndex}`,
        path: `/pages/${toIndex}`
      }]);

    } else {
      // Reordering blocks
      const sourcePageId = source.droppableId.replace('page-blocks-', '');
      const destPageId = destination.droppableId.replace('page-blocks-', '');
      const sourcePageIndex = getGlobalPageIndex(sourcePageId);
      const destPageIndex = getGlobalPageIndex(destPageId);

      if (sourcePageIndex !== -1 && destPageIndex !== -1) {
        applyJsonPatch([{
          op: 'move',
          from: `/pages/${sourcePageIndex}/blocks/${source.index}`,
          path: `/pages/${destPageIndex}/blocks/${destination.index}`
        }]);
      }
    }
  };

  const addQuestionPage = () => {
    // Sequence naming: e.g., "3페이지" if there are 2 existing default pages
    const count = questionPages.length;
    applyJsonPatch([{
      op: 'add',
      path: '/pages/-', // This appends to the end
      value: { 
        id: Math.random().toString(36).substring(7), 
        type: 'default',
        title: generateQuestionPageTitle(count), 
        blocks: [] 
      }
    }]);
  };
  
  const addEndingPage = () => {
    // Sequence naming: e.g., "2 종료 페이지" if there is already 1 ending page
    const count = endingPages.length;
    applyJsonPatch([{
      op: 'add',
      path: '/pages/-',
      value: { 
        id: Math.random().toString(36).substring(7), 
        type: 'ending',
        title: generateEndingPageTitle(count), 
        blocks: [] 
      }
    }]);
  };

  const deletePage = (e: React.MouseEvent, pageId: string) => {
    e.stopPropagation();
    
    // Safety check: Prevent deleting if it's the last ending page or Start Page
    const page = formFactor?.pages.find(p => p.id === pageId);
    if (!page) return;
    
    if (page.type === 'start') {
        alert('시작 페이지는 삭제할 수 없습니다.');
        return;
    }

    if (page.type === 'ending' && endingPages.length <= 1) {
        alert('최소 하나의 종료 페이지가 필요합니다.');
        return; 
    }

    const index = getGlobalPageIndex(pageId);
    if (index !== -1) {
      applyJsonPatch([{ op: 'remove', path: `/pages/${index}` }]);
    }
  };

  const addBlock = (e: React.MouseEvent, pageId: string) => {
    e.stopPropagation();
    const pageIndex = getGlobalPageIndex(pageId);
    if (pageIndex !== -1) {
      const page = formFactor?.pages[pageIndex];
      // Restrict Ending page to only 'info' (general) blocks or similar. 
      // For now, if ending, we default to 'info' text block.
      // If question page, we default to 'text' input.
      
      const isEnding = page?.type === 'ending';
      
      // Expand the page when adding a block
      setExpandedPages(prev => ({ ...prev, [pageId]: true }));
      
      applyJsonPatch([{
        op: 'add',
        path: `/pages/${pageIndex}/blocks/-`,
        value: {
          id: Math.random().toString(36).substring(7),
          type: isEnding ? 'info' : 'text', // Ending = General/Info, Question = Input
          content: { 
            label: isEnding ? '안내 문구' : '새로운 질문',
            // Add default body for info block if needed
            ...(isEnding ? { body: '감사합니다. 제출이 완료되었습니다.' } : {})
          }
        }
      }]);
    }
  };

  const deleteBlock = (e: React.MouseEvent, pageId: string, blockIndex: number) => {
    e.stopPropagation();
    const pageIndex = getGlobalPageIndex(pageId);
    if (pageIndex !== -1) {
      applyJsonPatch([{
        op: 'remove',
        path: `/pages/${pageIndex}/blocks/${blockIndex}`
      }]);
    }
  };

  const duplicateBlock = (e: React.MouseEvent, pageId: string, block: FormBlock) => {
    e.stopPropagation();
    const pageIndex = getGlobalPageIndex(pageId);
    if (pageIndex !== -1) {
      const newBlock = { ...block, id: Math.random().toString(36).substring(7) };
      applyJsonPatch([{
        op: 'add',
        path: `/pages/${pageIndex}/blocks/-`,
        value: newBlock
      }]);
    }
  };

  const handleTitleSubmit = (pageId: string) => {
    if (!editTitle.trim()) {
      setEditingPageId(null);
      return;
    }
    
    const pageIndex = getGlobalPageIndex(pageId);
    if (pageIndex !== -1) {
      applyJsonPatch([{
        op: 'replace',
        path: `/pages/${pageIndex}/title`,
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
    const canDelete = isStart ? false : (isEnding ? endingPages.length > 1 : true);
    
    const isRemoved = page.reviewStatus === 'removed';
    const isAdded = page.reviewStatus === 'added';
    
    // Style adjustments
    const containerStyle: React.CSSProperties = {
        opacity: isRemoved ? 0.5 : 1,
        pointerEvents: isRemoved ? 'none' : 'auto',
        position: 'relative',
        textDecoration: isRemoved ? 'line-through' : 'none',
    };
    
    // Label Logic
    const isPrimaryEnding = isEnding && allPages.findIndex(p => p.type === 'ending') === index;
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
        <Droppable droppableId={`page-blocks-${page.id}`} type="BLOCK">
          {(provided) => (
            <div 
              ref={provided.innerRef}
              {...provided.droppableProps}
              style={{ minHeight: '10px' }} 
            >
              {/* Metadata Pseudo-Block for Start Page */}
              {isStart && (
                <div 
                  className={styles.blockItem}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePageId(page.id);
                    setActiveBlockId('form-metadata');
                  }}
                  style={{
                      backgroundColor: activeBlockId === 'form-metadata' ? 'rgba(59, 130, 246, 0.1)' : undefined,
                      cursor: 'pointer',
                      borderLeft: '3px solid transparent', // visual distinguish?
                  }}
                >
                  <span className={styles.blockIcon}>T</span>
                  <span className={styles.blockLabel}>설문 제목 및 설명</span>
                </div>
              )}

              {/* Metadata Pseudo-Block for Ending Page */}
              {isEnding && (
                <div 
                  className={styles.blockItem}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePageId(page.id);
                    setActiveBlockId(`page-meta-${page.id}`);
                  }}
                  style={{
                      backgroundColor: activeBlockId === `page-meta-${page.id}` ? 'rgba(59, 130, 246, 0.1)' : undefined,
                      cursor: 'pointer'
                  }}
                >
                  <span className={styles.blockIcon}>i</span>
                  <span className={styles.blockLabel}>종료 메시지</span>
                </div>
              )}

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
                        setActivePageId(page.id); // Also set page active
                        setActiveBlockId(block.id);
                      }}
                      style={{
                          ...provided.draggableProps.style,
                          backgroundColor: activeBlockId === block.id ? 'rgba(59, 130, 246, 0.1)' : undefined
                      }}
                    >
                      <span className={styles.blockIcon}>
                        {block.type === 'text' && 'T'}
                        {block.type === 'choice' && 'C'}
                        {block.type === 'info' && 'i'}
                      </span>
                      <span className={styles.blockLabel}>
                        {block.content.label || block.type}
                      </span>
                      
                      <div className={styles.blockActions}>
                        <button 
                          className={styles.actionBtn}
                          onClick={(e) => duplicateBlock(e, page.id, block)}
                          title="복제"
                        >
                          <Copy size={12} />
                        </button>
                        <button 
                          className={styles.actionBtn}
                          onClick={(e) => deleteBlock(e, page.id, bIndex)}
                          title="삭제"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
              {page.blocks.length === 0 && !isStart && !isEnding && (
                <div className={styles.empty} style={{ padding: '8px', fontSize: '0.8rem' }}>
                  문항 없음
                </div>
              )}
            </div>
          )}
        </Droppable>
      </div>
    );

    if (isStart) {
       // Start page is NOT draggable
       return (
         <div className={styles.pageGroup} key={page.id} style={containerStyle}>
            {content}
            {blocksList}
         </div>
       );
    }

    return (
      <Draggable key={page.id} draggableId={page.id} index={index} isDragDisabled={isEnding || isRemoved || isImmutable}> 
        {/* Disable drag for ending pages for now to simplify */}
        {(provided) => (
          <div 
            className={styles.pageGroup}
            ref={provided.innerRef}
            {...provided.draggableProps}
            style={{ ...provided.draggableProps.style, ...containerStyle }}
          >
            {/* We need to pass dragHandleProps to the handle explicitly, but for simplified structure
                we might need to clone element or restructure.
                Previous was a direct child.
                Fix: Apply dragHandleProps to the handle div inside content, 
                BUT since content is a variable, we can't easily pass it.
                Let's inline the content logic.
            */}
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
                {!isEnding && !isImmutable && (
                  <div {...provided.dragHandleProps} className={styles.dragHandle}>
                    <GripVertical size={14} />
                  </div>
                )}
                
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

            {/* Blocks List (Accordion Content) */}
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
                  {questionPages.map((page, index) => renderPageItem(page, index, false, false))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
            
            {questionPages.length === 0 && (
               <div className={styles.empty}>페이지가 없습니다</div>
            )}
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
