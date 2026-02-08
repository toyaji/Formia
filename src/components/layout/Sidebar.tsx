import { useFormStore } from '@/store/useFormStore';
import styles from './Sidebar.module.css';
import { FormBlock } from '@/lib/core/schema';
import { GripVertical, Plus } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

export const Sidebar = () => {
  const { formFactor, activePageId, setActivePageId, applyJsonPatch } = useFormStore();

  const onDragEnd = (result: DropResult) => {
    const { source, destination, type } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    if (type === 'PAGE') {
      applyJsonPatch([{
        op: 'move',
        from: `/pages/${source.index}`,
        path: `/pages/${destination.index}`
      }]);
    } else {
      // Find source and destination page indices
      const sourcePageId = source.droppableId.replace('page-blocks-', '');
      const destPageId = destination.droppableId.replace('page-blocks-', '');
      const sourcePageIndex = formFactor?.pages.findIndex(p => p.id === sourcePageId);
      const destPageIndex = formFactor?.pages.findIndex(p => p.id === destPageId);

      if (sourcePageIndex !== undefined && destPageIndex !== undefined) {
        applyJsonPatch([{
          op: 'move',
          from: `/pages/${sourcePageIndex}/blocks/${source.index}`,
          path: `/pages/${destPageIndex}/blocks/${destination.index}`
        }]);
      }
    }
  };

  const addPage = () => {
    applyJsonPatch([{
      op: 'add',
      path: '/pages/-',
      value: { id: Math.random().toString(36).substring(7), title: 'New Page', blocks: [] }
    }]);
  };

  return (
    <div className={styles.sidebarContent}>
      <div className={styles.sectionHeader}>
        <span>Pages & Blocks</span>
        <button className={styles.addBtn} onClick={addPage} title="Add Page">
          <Plus size={14} />
        </button>
      </div>
      
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="pages" type="PAGE">
          {(provided) => (
            <div 
              className={styles.pageList}
              {...provided.droppableProps}
              ref={provided.innerRef}
            >
              {formFactor?.pages.map((page, index) => (
                <Draggable key={page.id} draggableId={page.id} index={index}>
                  {(provided) => (
                    <div 
                      className={styles.pageGroup}
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                    >
                      <div 
                        className={`${styles.pageHeader} ${activePageId === page.id ? styles.active : ''}`}
                        onClick={() => setActivePageId(page.id)}
                      >
                        <div {...provided.dragHandleProps} className={styles.dragHandle}>
                          <GripVertical size={14} />
                        </div>
                        <span className={styles.pageIcon}>📄</span>
                        <span className={styles.pageLabel}>{page.title || 'Untitled Page'}</span>
                      </div>
                      
                      <Droppable droppableId={`page-blocks-${page.id}`} type="BLOCK">
                        {(provided) => (
                          <div 
                            className={styles.blockList}
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                          >
                            {page.blocks.map((block: FormBlock, bIndex: number) => (
                              <Draggable key={block.id} draggableId={block.id} index={bIndex}>
                                {(provided) => (
                                  <div 
                                    className={styles.blockItem}
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                  >
                                    <span className={styles.blockIcon}>
                                      {block.type === 'text' && 'T'}
                                      {block.type === 'choice' && 'C'}
                                      {block.type === 'info' && 'i'}
                                    </span>
                                    <span className={styles.blockLabel}>
                                      {block.content.label || block.type}
                                    </span>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
      
      {(!formFactor?.pages || formFactor.pages.length === 0) && (
        <div className={styles.empty}>No pages yet</div>
      )}
    </div>
  );
};
