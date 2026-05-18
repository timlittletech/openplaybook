/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  ChevronRight,
  ChevronLeft, 
  ChevronDown, 
  BookOpen, 
  ShieldAlert, 
  PlayCircle, 
  FileText, 
  CheckCircle2, 
  Clock, 
  History,
  LayoutDashboard,
  Menu,
  X,
  Search,
  Filter,
  User,
  Users,
  Settings,
  Calendar,
  Tag,
  Book,
  FileBox,
  Link,
  MoreVertical,
  LogIn,
  LogOut,
  Check,
  RotateCcw,
  Plus,
  Trash2,
  Save,
  Edit2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { Star } from 'lucide-react';
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
  OrganizationSwitcher,
  CreateOrganization,
  useOrganization,
} from '@clerk/clerk-react';
import { PlaybookProvider, usePlaybook } from './contexts/PlaybookContext';
import { BrandedMarkdown } from './components/BrandedMarkdown';
import { mockUsers } from './data';
import { 
  PlaybookDocumentUnion, 
  PlaybookDocument,
  FactorDocument,
  AppUser, 
  UserRole, 
  Permissions,
  PlaybookReference,
  OpenPlaybookStep
} from './types';

// --- Registry Helpers ---

const getResolvedNode = (id: string, registry: Record<string, PlaybookDocumentUnion>): PlaybookDocumentUnion => {
  return registry[id] || registry['root-factor'] || Object.values(registry)[0];
};

const getTitle = (node: PlaybookDocumentUnion): string => {
  if (node.entity_type === 'factor') return node.label;
  return node.info.title;
};

const getDescription = (node: PlaybookDocumentUnion): string => {
  if (node.entity_type === 'factor') return node.description;
  return node.info.description;
};

const getCategories = (node: PlaybookDocumentUnion): string[] => {
  return node.entity_type === 'playbook' ? node.info.categories : (node.categories || []);
};

const getChildren = (node: PlaybookDocumentUnion, registry: Record<string, PlaybookDocumentUnion>, categoryFilter?: string): PlaybookReference[] => {
  const nodeId = node.entity_type === 'playbook' ? node.info.id : node.id;
  const children: PlaybookReference[] = [];
  
  // 1. Explicit children (Factors define their own branches)
  if (node.entity_type === 'factor') {
    children.push(...node.children);
  }

  // 2. Discover children pointing to this node as parent (Linear Path)
  Object.values(registry).forEach(other => {
    if (other.parent_id === nodeId) {
       const otherId = (other.entity_type === 'playbook' ? other.info.id : other.id);
       if (!children.some(c => c.ref_id === otherId)) {
         children.push({
           type: other.entity_type,
           ref_id: otherId
         });
       }
    }
  });

  // Filter by category if requested
  if (categoryFilter) {
    return children.filter(c => {
      const childNode = getResolvedNode(c.ref_id, registry);
      return getCategories(childNode).includes(categoryFilter);
    });
  }

  return children;
};

// --- RBAC Helpers ---

const hasPermission = (user: AppUser, node: PlaybookDocumentUnion, action: 'read' | 'update' | 'approve' | 'edit'): boolean => {
  if (user.role === 'Administrator') return true;

  // Check OpenPlaybook JSON "access_control"
  if (node.entity_type === 'playbook') {
    const pb = node as PlaybookDocument;
    const config = action === 'read' ? pb.access_control.view : (action === 'edit' || action === 'update' ? pb.access_control.edit : pb.access_control.approve);
    
    if (config?.roles?.includes(user.role)) return true;
    if (config?.teams?.some(team => user.teams.includes(team))) return true;
    if (config?.users?.includes(user.id)) return true;
  }
  
  // Fallback to proprietary ACL overlay if available
  if (node.acl) {
    const rolePerms = node.acl.roles[user.role];
    if (action === 'read' && rolePerms?.read) return true;
    if ((action === 'update' || action === 'edit' ) && rolePerms?.update) return true;
    if (node.acl.users.includes(user.id)) return true;
    if (user.teams.some(team => node.acl.teams.includes(team))) return true;
  }

  return false;
};

// --- Search Logic ---

interface SearchFilters {
  query: string;
  subType?: 'Course' | 'Step' | 'Rule';
  category?: string;
  department?: string;
  tags: string[];
}

const searchRegistry = (
  filters: SearchFilters,
  user: AppUser,
  registry: Record<string, PlaybookDocumentUnion>
): PlaybookDocumentUnion[] => {
  const results: PlaybookDocumentUnion[] = [];
  
  Object.values(registry).forEach(node => {
    if (!hasPermission(user, node, 'read')) return;

    const title = getTitle(node);
    const desc = getDescription(node);
    const tags = node.entity_type === 'playbook' ? (node as PlaybookDocument).tags || [] : [];
    const nodeCategories = node.entity_type === 'playbook' 
      ? (node as PlaybookDocument).info.categories 
      : (node as FactorDocument).categories || [];
    const department = node.entity_type === 'playbook' ? (node as PlaybookDocument).info.department : '';

    const matchesQuery = !filters.query || 
      title.toLowerCase().includes(filters.query.toLowerCase()) ||
      desc.toLowerCase().includes(filters.query.toLowerCase()) ||
      tags.some(t => t.toLowerCase().includes(filters.query.toLowerCase()));

    const matchesType = !filters.subType || 
      (filters.subType === 'Rule' && node.entity_type === 'factor') ||
      (node.entity_type === 'playbook' && (node as PlaybookDocument).subType === filters.subType);

    const matchesCategory = !filters.category || nodeCategories.includes(filters.category);
    const matchesDepartment = !filters.department || department === filters.department;

    const matchesTags = filters.tags.length === 0 || 
      filters.tags.every(tag => tags.includes(tag));

    if (matchesQuery && matchesType && matchesCategory && matchesDepartment && matchesTags) {
      results.push(node);
    }
  });

  return results;
};

// --- Components ---

interface SidebarItemProps {
  nodeId: string;
  selectedId: string;
  onSelect: (id: string) => void;
  depth?: number;
  user: AppUser;
  categoryFilter: string;
  registry: Record<string, PlaybookDocumentUnion>;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ 
  nodeId, 
  selectedId, 
  onSelect, 
  depth = 0,
  user,
  categoryFilter,
  registry
}) => {
  const node = getResolvedNode(nodeId, registry);
  const [isOpen, setIsOpen] = useState(true);
  const isSelected = nodeId === selectedId;
  const children = getChildren(node, registry, categoryFilter);
  const hasChildren = children.length > 0;

  const Icon = node.entity_type === 'playbook' ? BookOpen : ShieldAlert;
  const label = getTitle(node);

  if (depth > 5) return null;

  return (
    <div className="flex flex-col">
      <div 
        className={`flex items-center gap-2 py-1 px-2 rounded-lg cursor-pointer transition-all group ${
          isSelected 
            ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100 shadow-sm' 
            : 'text-slate-600 hover:bg-slate-50'
        }`}
        style={{ marginLeft: `${depth * 0.3}rem` }}
        onClick={() => {
          onSelect(nodeId);
          if (hasChildren) setIsOpen(!isOpen);
        }}
      >
        <div className="w-3.5 h-3.5 flex items-center justify-center">
          {hasChildren && (
            isOpen ? <ChevronDown className={`w-2.5 h-2.5 ${isSelected ? 'text-indigo-400' : 'text-slate-400'}`} /> : <ChevronRight className={`w-2.5 h-2.5 ${isSelected ? 'text-indigo-400' : 'text-slate-400'}`} />
          )}
        </div>
        <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
        <span className="text-[11px] truncate tracking-tight">{label}</span>
      </div>
      
      {hasChildren && isOpen && (
        <div className="flex flex-col mt-0.5 border-l border-slate-100 ml-3">
          {children.map((child) => (
            <SidebarItem 
              key={child.ref_id} 
              nodeId={child.ref_id} 
              selectedId={selectedId} 
              onSelect={onSelect} 
              depth={depth + 1}
              user={user}
              categoryFilter={categoryFilter}
              registry={registry}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface BusinessRuleBlockProps {
  factor: FactorDocument;
  onSelect: (id: string) => void;
  onKdfSelect: (kdfId: string, value: string) => void;
  onCategorySelect?: (cat: string) => void;
  kdfChoice?: string;
  user: AppUser;
  registry: Record<string, PlaybookDocumentUnion>;
}

const BusinessRuleBlock: React.FC<BusinessRuleBlockProps> = ({ 
  factor, 
  onSelect, 
  onKdfSelect, 
  onCategorySelect,
  kdfChoice, 
  user,
  registry
}) => {
  const { isEditMode, saveDraft } = usePlaybook();
  const relatedPlaybooks = useMemo(() => {
    const refs: PlaybookReference[] = factor.related_playbooks || [];
    return refs.filter(r => {
      const node = getResolvedNode(r.ref_id, registry);
      if (!hasPermission(user, node, 'read')) return false;

      // Conditional check: if matchValue is defined, current choice must match
      if (r.matchValue && kdfChoice !== r.matchValue) return false;
      
      return true;
    });
  }, [factor, user, kdfChoice, registry]);

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 px-3 shadow-sm relative group">
      {isEditMode && (
        <div className="absolute -top-3 -right-3 p-1.5 bg-amber-500 rounded-lg text-white shadow-lg animate-in fade-in slide-in-from-bottom-1">
          <Edit2 className="w-3 h-3" />
        </div>
      )}
      
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shadow-sm shadow-amber-200"></div>
          <h4 className="text-[10px] uppercase tracking-widest text-amber-900 flex items-center gap-1 flex-1">
            <span className="font-light shrink-0">Business Rule: </span>
            {isEditMode ? (
              <input 
                className="bg-white/50 border-b border-amber-300 focus:outline-none focus:border-amber-600 font-black px-1 flex-1 min-w-0"
                value={factor.label}
                onChange={(e) => saveDraft(factor.id, { label: e.target.value })}
              />
            ) : (
              <span className="font-black truncate">{factor.label}</span>
            )}
          </h4>
        </div>
        <div className="flex items-center gap-4">
          {kdfChoice && (
            <button 
              onClick={() => onKdfSelect(factor.id, '')}
              className="text-[9px] font-bold text-amber-600 hover:text-amber-800 uppercase tracking-tighter"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {isEditMode ? (
        <textarea 
          className="w-full bg-white/50 border border-amber-200 rounded-xl p-2 text-xs text-slate-600 focus:outline-none focus:border-amber-500 mb-4 h-16 resize-none"
          placeholder="Description..."
          value={factor.description}
          onChange={(e) => saveDraft(factor.id, { description: e.target.value })}
        />
      ) : factor.description && (
        <p className="text-[11px] text-slate-500 leading-relaxed mb-4 px-1">{factor.description}</p>
      )}

      {factor.controlType === 'boolean' && (
        <div className="flex gap-3">
          {['Yes', 'No'].map((val) => (
            <button
              key={val}
              onClick={() => onKdfSelect(factor.id, val)}
              className={`flex-1 py-2.5 rounded-xl border text-sm font-black transition-all ${
                kdfChoice === val 
                  ? 'bg-amber-500 border-amber-600 text-white shadow-md' 
                  : 'bg-white border-amber-200 text-amber-900 hover:border-amber-400 shadow-sm'
              }`}
            >
              {val}
            </button>
          ))}
        </div>
      )}

      {factor.controlType === 'enum' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {factor.children
            .filter(c => hasPermission(user, getResolvedNode(c.ref_id, registry), 'read'))
            .map((choice) => {
              const choiceNode = getResolvedNode(choice.ref_id, registry);
              const label = choice.matchValue || getTitle(choiceNode);
              return (
                <button 
                  key={choice.ref_id}
                  onClick={() => onKdfSelect(factor.id, label)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    kdfChoice === label
                      ? 'bg-amber-500 border-amber-600 text-white shadow-lg' 
                      : 'bg-white border-amber-200 text-slate-700 hover:border-amber-400 shadow-sm'
                  }`}
                >
                  <span className="text-sm font-black block leading-tight">{label}</span>
                </button>
              );
            })}
        </div>
      )}

      {factor.controlType === 'text' && (
        <div className="relative">
          <input 
            type="text" 
            placeholder={factor.placeholder || "Enter value to match..."}
            value={kdfChoice}
            onChange={(e) => onKdfSelect(factor.id, e.target.value)}
            className="w-full bg-white border-2 border-amber-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:border-amber-400 transition-colors"
          />
        </div>
      )}

      {/* Related Playbooks for Rules */}
      {relatedPlaybooks.length > 0 && (
        <div className="mt-8 pt-6 border-t border-amber-100">
           <h3 className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Tag className="w-3 h-3 text-amber-400" /> Related Playbooks
           </h3>
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
             {relatedPlaybooks.map(ref => {
               const refNode = getResolvedNode(ref.ref_id, registry);
               const firstCat = getCategories(refNode)[0];
               const isPlaybook = refNode.entity_type === 'playbook';
               return (
                 <button 
                   key={ref.ref_id}
                   onClick={() => {
                      if (onCategorySelect) onCategorySelect(firstCat);
                      onSelect(ref.ref_id);
                   }}
                   className="flex items-center gap-2 p-2 bg-white hover:bg-amber-100/50 border border-amber-100 rounded-xl transition-all group text-left"
                 >
                   <div className="p-1.5 bg-amber-50 rounded shadow-sm text-amber-400 group-hover:text-amber-600 transition-colors">
                      {isPlaybook ? <BookOpen className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                   </div>
                   <div className="flex flex-col min-w-0">
                     <span className="text-[8px] font-black uppercase text-amber-500 leading-none mb-0.5">{firstCat}</span>
                     <span className="text-[10px] font-bold text-slate-700 truncate group-hover:text-amber-900">{getTitle(refNode)}</span>
                   </div>
                 </button>
               );
             })}
           </div>
        </div>
      )}
    </div>
  );
};

// --- Factor / Rule Rendering Component ---

interface FactorTreeItemProps {
  factor: FactorDocument;
  onSelect: (id: string) => void;
  onKdfSelect: (kdfId: string, value: string) => void;
  onCategorySelect?: (cat: string) => void;
  kdfChoices: Record<string, string>;
  user: AppUser;
  depth: number;
  registry: Record<string, PlaybookDocumentUnion>;
}

const FactorTreeItem: React.FC<FactorTreeItemProps> = ({
  factor,
  onSelect,
  onKdfSelect,
  onCategorySelect,
  kdfChoices,
  user,
  depth,
  registry
}) => {
  const { isEditMode, saveDraft } = usePlaybook();
  const [isRollup, setIsRollup] = useState(false);
  const kdfChoice = kdfChoices[factor.id] || '';
  
  const matchedRefs = useMemo(() => {
    if (!kdfChoice) return [];
    return factor.children.filter(c => {
       const node = getResolvedNode(c.ref_id, registry);
       const nodeCats = getCategories(node);
       const parentCats = factor.categories || [];
       return c.matchValue === kdfChoice && nodeCats.includes(parentCats[0]);
    });
  }, [factor, kdfChoice, registry]);

  return (
    <div className="space-y-1 relative">
      <BusinessRuleBlock 
        factor={factor}
        onSelect={onSelect}
        onKdfSelect={onKdfSelect}
        onCategorySelect={onCategorySelect}
        kdfChoice={kdfChoice}
        user={user}
        registry={registry}
      />

      {isEditMode && hasPermission(user, factor, 'update') && (
        <div className="flex justify-center mt-2 px-4">
           <button 
            onClick={() => {
              const matchVal = prompt('Enter the condition (choice) for this link (e.g., "Yes" or "[Choice Title]"):');
              const refId = prompt('Enter the node ID to link:');
              if (matchVal && refId) {
                const newChildren = [...factor.children, { ref_id: refId, type: 'playbook' as const, matchValue: matchVal } as PlaybookReference];
                saveDraft(factor.id, { children: newChildren });
              }
            }}
            className="w-full py-2 border-2 border-dashed border-amber-200 rounded-xl text-[10px] font-black text-amber-500 uppercase tracking-widest hover:bg-amber-50 transition-all flex items-center justify-center gap-2"
           >
             <Plus className="w-3 h-3" /> Link Resulting Node
           </button>
        </div>
      )}

      {matchedRefs.length > 0 && (
        <div className="space-y-0">
          {/* Business Rule Themed Toggle */}
          <div className="relative flex justify-center py-2 z-10">
            <button 
              onClick={() => setIsRollup(!isRollup)}
              className="group flex items-center justify-center w-10 h-10 bg-amber-50 hover:bg-amber-500 border-2 border-amber-200 hover:border-amber-600 rounded-lg shadow-md transition-all text-amber-500 hover:text-white"
            >
              <motion.div
                animate={{ rotate: isRollup ? 180 : 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="flex items-center justify-center"
              >
                <ChevronDown className="w-6 h-6" />
              </motion.div>
            </button>
          </div>

          <AnimatePresence initial={false}>
            {!isRollup && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                className="relative overflow-hidden"
              >
                <div className="pl-6 md:pl-10 relative pb-4">
                  <div className="absolute left-3 md:left-5 top-0 bottom-0 w-0.5 bg-amber-100/50" />
                  
                  <div className="space-y-12 pt-6">
                    {matchedRefs.map(ref => (
                      <div key={ref.ref_id} className="animate-in fade-in slide-in-from-top-2 duration-500">
                        {ref.type === 'playbook' ? (
                          <RecursivePlaybookRenderer 
                            playbook={getResolvedNode(ref.ref_id, registry) as PlaybookDocument}
                            onSelect={onSelect}
                            user={user}
                            depth={depth + 1}
                            kdfChoices={kdfChoices}
                            onKdfSelect={onKdfSelect}
                            onCategorySelect={onCategorySelect}
                            registry={registry}
                          />
                        ) : (
                          <FactorTreeItem 
                            factor={getResolvedNode(ref.ref_id, registry) as FactorDocument}
                            onSelect={onSelect}
                            onKdfSelect={onKdfSelect}
                            onCategorySelect={onCategorySelect}
                            kdfChoices={kdfChoices}
                            user={user}
                            depth={depth + 1}
                            registry={registry}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

interface PlaybookViewerProps {
  playbook: PlaybookDocument;
  onSelect: (id: string) => void;
  user: AppUser;
  depth: number;
  kdfChoices: Record<string, string>;
  onKdfSelect: (kdfId: string, value: string) => void;
  registry: Record<string, PlaybookDocumentUnion>;
}

const RecursivePlaybookRenderer: React.FC<PlaybookViewerProps & { onCategorySelect?: (cat: string) => void }> = ({ 
  playbook, 
  onSelect, 
  user, 
  depth,
  kdfChoices,
  onKdfSelect,
  onCategorySelect,
  registry
}) => {
  const { isEditMode, saveDraft, getVersions, isFavorite, toggleFavorite } = usePlaybook();
  const [isRollup, setIsRollup] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);

  useEffect(() => {
    if (showHistory) {
      getVersions(playbook.info.id).then(setVersions);
    }
  }, [showHistory, playbook.info.id, getVersions]);

  const canUpdate = hasPermission(user, playbook, 'update');
  const children = getChildren(playbook, registry);
  const visibleChildren = children.filter(child => {
    const node = getResolvedNode(child.ref_id, registry);
    const hasPerm = hasPermission(user, node, 'read');
    if (!hasPerm) return false;
    
    // Only auto-expand if same category
    const nodeCats = getCategories(node);
    const parentPrimaryCat = playbook.info.categories[0];
    return nodeCats.includes(parentPrimaryCat);
  });
  
  const relatedPlaybooks = useMemo(() => {
    const refs = new Map<string, PlaybookReference>();
    
    // 1. Explicit related_playbooks
    (playbook.related_playbooks || []).forEach(r => refs.set(r.ref_id, r));
    
    // 2. Discover children that were filtered out of expansion (different category)
    const allChildren = getChildren(playbook, registry);
    allChildren.forEach(child => {
      const childNode = getResolvedNode(child.ref_id, registry);
      const childCats = getCategories(childNode);
      if (!childCats.includes(playbook.info.categories[0])) {
        if (!refs.has(child.ref_id)) {
          refs.set(child.ref_id, child);
        }
      }
    });

    return Array.from(refs.values()).filter(r => hasPermission(user, getResolvedNode(r.ref_id, registry), 'read'));
  }, [playbook, user, registry]);

  if (depth > 5) return (
    <div className="p-4 border border-dashed border-slate-200 rounded-xl text-center text-[10px] uppercase font-bold text-slate-400">
      Depth Limit Reached (Max 5 Layers)
    </div>
  );

  return (
    <div className="space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-500 relative">
      <AnimatePresence>
        {showHistory && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute left-full top-0 w-80 ml-4 bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 z-50 h-full overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-500" /> Version History
              </h3>
              <button onClick={() => setShowHistory(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            
            <div className="space-y-4">
              {versions.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">No previous versions</p>
                </div>
              ) : (
                versions.map((v, i) => (
                  <div key={v.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:border-indigo-200 transition-all">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase">v{v.metadata.versionNumber}</span>
                      <span className="text-[9px] text-slate-400 font-bold">{new Date(v.metadata.timestamp).toLocaleDateString()}</span>
                    </div>
                    <p className="text-[11px] font-bold text-slate-700 mb-2">{v.metadata.changeNote}</p>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[8px] font-black text-indigo-600 border border-indigo-200">
                        {v.metadata.authorName[0]}
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{v.metadata.authorName}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isEditMode && canUpdate && (
        <div className="absolute -top-3 -right-3 p-1.5 bg-indigo-600 rounded-lg text-white shadow-lg z-30 animate-in fade-in slide-in-from-bottom-1">
          <Edit2 className="w-3 h-3" />
        </div>
      )}

      {/* Playbook Card */}
      <div className={`bg-white rounded-2xl shadow-sm border ${depth === 0 ? 'border-slate-200 p-8 px-5' : 'border-slate-100 p-6 px-4'} ${isEditMode && canUpdate ? 'ring-2 ring-indigo-500/20' : ''}`}>
        <div className="flex justify-between items-start mb-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2 h-2 rounded-full ${depth === 0 ? 'bg-indigo-600' : 'bg-slate-300'}`} />
              <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full uppercase tracking-wider">
                {playbook.info.id.startsWith('pb-') ? 'Playbook' : 'Course'}: {playbook.subType === 'Standard' ? 'Step' : (playbook.subType || 'Step')}
              </span>
              {canUpdate && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ml-1 ${isEditMode ? 'bg-indigo-600 text-white' : 'bg-emerald-50 text-emerald-700'}`}>
                  {isEditMode ? 'Editing' : 'Editor'}
                </span>
              )}
              <button 
                onClick={() => setShowHistory(!showHistory)}
                className={`text-[9px] font-black uppercase px-2 py-0.5 rounded transition-all ml-2 flex items-center gap-1.5 border border-slate-200 ${showHistory ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
              >
                <Clock className="w-2.5 h-2.5" />
                v{playbook.lastVersion || 1}
              </button>
            </div>
            {isEditMode && canUpdate ? (
              <input 
                className="text-3xl font-black text-slate-900 bg-indigo-50/50 border-b-2 border-indigo-200 focus:outline-none focus:border-indigo-600 block w-full px-2 py-1 mb-2"
                value={playbook.info.title}
                onChange={(e) => saveDraft(playbook.info.id, { info: { ...playbook.info, title: e.target.value } })}
              />
            ) : (
              <h2 className={`${depth === 0 ? 'text-3xl' : 'text-xl'} font-bold text-slate-900 tracking-tight`}>{playbook.info.title}</h2>
            )}
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <button
              onClick={() => toggleFavorite(playbook.info.id)}
              title={isFavorite(playbook.info.id) ? 'Remove from favorites' : 'Add to favorites'}
              className={`p-2 rounded-lg border transition-all ${
                isFavorite(playbook.info.id)
                  ? 'bg-amber-50 border-amber-200 text-amber-500'
                  : 'bg-white border-slate-200 text-slate-300 hover:text-amber-400 hover:border-amber-200'
              }`}
            >
              <Star className="w-4 h-4" fill={isFavorite(playbook.info.id) ? 'currentColor' : 'none'} />
            </button>
            <div className="text-right">
              <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest block mb-1 leading-none">Cadence</span>
              <span className="text-[10px] font-bold text-slate-900 uppercase bg-amber-50 px-2 py-1 rounded border border-amber-100 shadow-sm">{playbook.cadence || 'N/A'}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                <History className="w-3 h-3" /> Description
              </h3>
              {isEditMode && canUpdate ? (
                <textarea 
                  className="w-full text-sm text-slate-600 leading-relaxed italic bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-indigo-500 min-h-[100px] resize-none"
                  value={playbook.info.description}
                  onChange={(e) => saveDraft(playbook.info.id, { info: { ...playbook.info, description: e.target.value } })}
                />
              ) : (
                <p className="text-sm text-slate-600 leading-relaxed italic border-l-2 border-indigo-100 pl-4 py-1">
                  {playbook.info.description}
                </p>
              )}
            </div>
            
            <div className="flex flex-wrap gap-2">
              {playbook.info.categories.map(cat => (
                <button 
                  key={cat} 
                  onClick={() => onCategorySelect?.(cat)}
                  className="text-[9px] font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100 hover:bg-indigo-100 transition-colors"
                >
                  {cat}
                </button>
              ))}
              {playbook.tags?.map(tag => (
                <span key={tag} className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">#{tag}</span>
              ))}
            </div>
          </div>

          <div className="space-y-4">
             <div className="bg-slate-50/50 rounded-xl p-6 border border-slate-100 shadow-sm shadow-slate-200/50">
                {playbook.resources && playbook.resources.length > 0 ? (
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                       <LayoutDashboard className="w-3 h-3 text-indigo-400" /> Playbook Resources
                    </h3>
                    
                    {/* Highlighted/Featured Resource */}
                    <a 
                      href={playbook.resources[0].url} 
                      className="flex flex-col p-4 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-indigo-200">Featured Resource</span>
                        {playbook.resources[0].type === 'video' ? <PlayCircle className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                      </div>
                      <span className="text-sm font-black tracking-tight">{playbook.resources[0].name}</span>
                    </a>

                    {/* Additional Resources List */}
                    {playbook.resources.length > 1 && (
                      <div className="space-y-1.5 mt-4">
                        {playbook.resources.slice(1).map(res => (
                          <a 
                            key={res.name} 
                            href={res.url} 
                            className="flex items-center justify-between p-2.5 bg-white hover:bg-slate-50 rounded-lg border border-slate-100 transition-all group"
                          >
                            <div className="flex items-center gap-2">
                              <div className="p-1 bg-slate-50 rounded text-slate-400 group-hover:text-indigo-400 transition-colors">
                                {res.type === 'video' ? <PlayCircle className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                              </div>
                              <span className="text-[11px] font-bold text-slate-600">{res.name}</span>
                            </div>
                            <ChevronRight className="w-3 h-3 text-slate-300" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-8 text-center bg-white rounded-xl border border-dashed border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No primary resources</p>
                  </div>
                )}
             </div>
          </div>
        </div>

        {/* Long-form markdown body (SOP-style playbooks) */}
        {playbook.body_markdown && (
          <div className="mt-8 pt-8 border-t border-slate-50">
            {isEditMode && canUpdate ? (
              <div>
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <FileText className="w-3 h-3 text-indigo-500" /> SOP Body (Markdown)
                </h3>
                <textarea
                  className="w-full min-h-[400px] text-sm font-mono text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-4 focus:outline-none focus:border-indigo-500 resize-y"
                  value={playbook.body_markdown}
                  onChange={(e) => saveDraft(playbook.info.id, { body_markdown: e.target.value })}
                />
              </div>
            ) : (
              <BrandedMarkdown>{playbook.body_markdown}</BrandedMarkdown>
            )}
          </div>
        )}

        {/* Step list (hidden for SOP-style playbooks with no steps) */}
        {(playbook.steps.length > 0 || (isEditMode && canUpdate)) && (
        <div className="mt-8 pt-8 border-t border-slate-50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <CheckCircle2 className="w-3 h-3 text-indigo-500" /> Playbook Checklist
            </h3>
            {isEditMode && canUpdate && (
              <button
                onClick={() => {
                  const newStep = { step_id: `step_${Date.now()}`, action: 'New Step Content', type: 'task' };
                  saveDraft(playbook.info.id, { steps: [...playbook.steps, newStep] });
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100"
              >
                <Plus className="w-3 h-3" /> Add Step
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {playbook.steps.map((step, i) => (
              <div key={step.step_id} className={`p-2.5 bg-slate-50/30 rounded-xl border border-slate-100 hover:border-indigo-100 transition-all group flex items-start gap-3 ${isEditMode && canUpdate ? 'ring-1 ring-indigo-500/10' : ''}`}>
                <div className="shrink-0 flex items-center pt-1">
                  <input 
                    type="checkbox" 
                    className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  {isEditMode && canUpdate ? (
                    <div className="space-y-2">
                      <textarea 
                        className="text-[13px] font-medium text-slate-700 bg-white border border-slate-200 rounded-lg p-2 w-full focus:outline-none focus:border-indigo-500 h-20 resize-none"
                        value={step.action}
                        onChange={(e) => {
                          const newSteps = [...playbook.steps];
                          newSteps[i] = { ...newSteps[i], action: e.target.value };
                          saveDraft(playbook.info.id, { steps: newSteps });
                        }}
                      />
                      <input 
                        className="text-[11px] text-slate-500 italic bg-white border border-slate-100 rounded p-1 w-full focus:outline-none focus:border-indigo-500"
                        placeholder="Add note..."
                        value={step.note || ''}
                        onChange={(e) => {
                          const newSteps = [...playbook.steps];
                          newSteps[i] = { ...newSteps[i], note: e.target.value };
                          saveDraft(playbook.info.id, { steps: newSteps });
                        }}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="text-[13px] font-medium text-slate-500 group-hover:text-slate-700 transition-colors prose prose-slate max-w-none prose-sm leading-tight">
                        <Markdown>{step.action}</Markdown>
                      </div>
                      {step.note && (
                        <div className="text-[11px] text-slate-400 italic mt-0.5 prose prose-slate max-w-none prose-xs leading-tight opacity-80">
                          <Markdown>{step.note}</Markdown>
                        </div>
                      )}
                    </>
                  )}
                </div>
                {(step.resources && step.resources.length > 0 || (isEditMode && canUpdate)) && (
                  <div className="flex items-center gap-1 shrink-0">
                    {step.resources?.map(res => (
                      <div key={res.name} title={res.name} className="p-1 bg-white border border-slate-100 rounded text-slate-400">
                        {res.type === 'video' ? <PlayCircle className="w-2.5 h-2.5" /> : <FileText className="w-2.5 h-2.5" />}
                      </div>
                    ))}
                    {isEditMode && canUpdate && (
                      <button 
                        onClick={() => {
                          const newSteps = playbook.steps.filter(s => s.step_id !== step.step_id);
                          saveDraft(playbook.info.id, { steps: newSteps });
                        }}
                        className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        )}

        {/* Related Playbooks (Small Cards) */}
        {relatedPlaybooks.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-50">
             <div className="flex items-center justify-between mb-3">
               <h3 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Tag className="w-3 h-3 text-indigo-400" /> Related Playbooks
               </h3>
             </div>
             
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
               {relatedPlaybooks.map(ref => {
                 const refNode = getResolvedNode(ref.ref_id, registry);
                 const firstCat = getCategories(refNode)[0];
                 const isPlaybook = refNode.entity_type === 'playbook';
                 return (
                   <button 
                     key={ref.ref_id}
                     onClick={() => {
                        if (onCategorySelect) onCategorySelect(firstCat);
                        onSelect(ref.ref_id);
                     }}
                     className="flex items-center gap-3 p-3 bg-white hover:bg-slate-50 border border-slate-100 hover:border-indigo-200 rounded-xl transition-all group text-left shadow-sm hover:shadow-md"
                   >
                     <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 group-hover:bg-indigo-50 transition-colors">
                        {isPlaybook ? <BookOpen className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" /> : <ShieldAlert className="w-4 h-4 text-slate-400 group-hover:text-amber-500" />}
                     </div>
                     <div className="flex flex-col min-w-0">
                       <div className="flex items-center gap-1.5 mb-0.5">
                         <span className="text-[8px] font-black uppercase text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded leading-none">{firstCat}</span>
                         {isPlaybook && (refNode as PlaybookDocument).cadence && (
                           <span className="text-[8px] font-medium text-slate-400 italic">{(refNode as PlaybookDocument).cadence}</span>
                         )}
                       </div>
                       <span className="text-[11px] font-bold text-slate-700 truncate group-hover:text-slate-900">{getTitle(refNode)}</span>
                     </div>
                     <ChevronRight className="w-3 h-3 text-slate-300 ml-auto group-hover:text-indigo-400" />
                   </button>
                 );
               })}
             </div>
          </div>
        )}
      </div>

      {/* Children Rendering Toggle & Connector */}
      {visibleChildren.length > 0 && (
        <div className="relative flex justify-center py-2 z-10">
          <button 
            onClick={() => setIsRollup(!isRollup)}
            className="group flex items-center justify-center w-10 h-10 bg-white hover:bg-slate-900 border-2 border-slate-200 hover:border-slate-900 rounded-lg shadow-md transition-all text-slate-500 hover:text-white"
          >
            <motion.div
              animate={{ rotate: isRollup ? 180 : 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="flex items-center justify-center"
            >
              <ChevronDown className="w-6 h-6" />
            </motion.div>
          </button>
        </div>
      )}

      {/* Children Rendering */}
      <AnimatePresence initial={false}>
        {visibleChildren.length > 0 && !isRollup && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className="relative overflow-hidden"
          >
            <div className="relative pl-6 md:pl-10 pb-4">
              {/* Connector Line */}
              <div className="absolute left-3 md:left-5 top-0 bottom-0 w-0.5 bg-slate-100" />
              
              <div className="space-y-12 pt-4">
                {visibleChildren.map((childRef) => {
                  const child = getResolvedNode(childRef.ref_id, registry);
                  if (child.entity_type === 'playbook') {
                    return (
                      <RecursivePlaybookRenderer 
                        key={child.info.id}
                        playbook={child as PlaybookDocument}
                        onSelect={onSelect}
                        user={user}
                        depth={depth + 1}
                        kdfChoices={kdfChoices}
                        onKdfSelect={onKdfSelect}
                        registry={registry}
                      />
                    );
                  } else {
                    return (
                      <FactorTreeItem 
                        key={child.id}
                        factor={child as FactorDocument}
                        onSelect={onSelect}
                        onKdfSelect={onKdfSelect}
                        onCategorySelect={onCategorySelect}
                        kdfChoices={kdfChoices}
                        user={user}
                        depth={depth + 1}
                        registry={registry}
                      />
                    );
                  }
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Wiki-style sidebar (collapsible category sections with nested playbooks) ---

interface WikiSidebarProps {
  roots: Record<string, string[]>;
  nodes: Record<string, PlaybookDocumentUnion>;
  selectedId: string;
  onSelect: (id: string) => void;
  user: AppUser;
  searchQuery: string;
}

const WikiSidebar: React.FC<WikiSidebarProps> = ({
  roots,
  nodes,
  selectedId,
  onSelect,
  user,
  searchQuery,
}) => {
  // Find which category the currently-selected node belongs to so we can auto-expand it
  const selectedNode = nodes[selectedId];
  const selectedCategory =
    selectedNode ? (getCategories(selectedNode)[0] ?? null) : null;

  const allCategories = useMemo(() => Object.keys(roots), [roots]);

  // Start with the active category expanded; users can collapse/expand others freely
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const s = new Set<string>();
    if (selectedCategory) s.add(selectedCategory);
    return s;
  });

  // Auto-expand the category of whatever's selected
  useEffect(() => {
    if (selectedCategory) {
      setExpanded(prev => {
        if (prev.has(selectedCategory)) return prev;
        const next = new Set(prev);
        next.add(selectedCategory);
        return next;
      });
    }
  }, [selectedCategory]);

  // When the user types in the search box, expand every category that has a match
  useEffect(() => {
    if (!searchQuery.trim()) return;
    const q = searchQuery.toLowerCase();
    setExpanded(prev => {
      const next = new Set(prev);
      allCategories.forEach(cat => {
        const ids = roots[cat] ?? [];
        const anyMatch = ids.some(id => {
          const n = nodes[id];
          return n && getTitle(n).toLowerCase().includes(q);
        });
        if (anyMatch) next.add(cat);
      });
      return next;
    });
  }, [searchQuery, allCategories, roots, nodes]);

  const toggle = (cat: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });

  const matchesQuery = (node: PlaybookDocumentUnion) => {
    if (!searchQuery.trim()) return true;
    return getTitle(node).toLowerCase().includes(searchQuery.toLowerCase());
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      {allCategories.map(cat => {
        const ids = roots[cat] ?? [];
        const visibleNodes = ids
          .map(id => nodes[id])
          .filter((n): n is PlaybookDocumentUnion => !!n)
          .filter(n => hasPermission(user, n, 'read'))
          .filter(matchesQuery);

        if (searchQuery.trim() && visibleNodes.length === 0) return null;

        const isOpen = expanded.has(cat);
        return (
          <div key={cat} className="border-b border-slate-50 last:border-b-0">
            <button
              onClick={() => toggle(cat)}
              className="flex items-center justify-between w-full px-4 py-2.5 hover:bg-slate-50 transition-colors group"
            >
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                {cat}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-300">{visibleNodes.length}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                    isOpen ? 'rotate-0' : '-rotate-90'
                  }`}
                />
              </div>
            </button>
            {isOpen && (
              <div className="pb-2">
                {visibleNodes.length === 0 ? (
                  <div className="px-6 py-2 text-[11px] italic text-slate-400">No pages</div>
                ) : (
                  visibleNodes.map(n => {
                    const id = n.entity_type === 'playbook' ? n.info.id : n.id;
                    const isSelected = id === selectedId;
                    const Icon = n.entity_type === 'playbook' ? BookOpen : ShieldAlert;
                    return (
                      <button
                        key={id}
                        onClick={() => onSelect(id)}
                        className={`flex items-center gap-2 w-full text-left pl-6 pr-4 py-1.5 transition-colors ${
                          isSelected
                            ? 'bg-indigo-50 text-indigo-800 border-l-2 border-indigo-600'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-l-2 border-transparent'
                        }`}
                      >
                        <Icon
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isSelected ? 'text-indigo-500' : 'text-slate-300'
                          }`}
                        />
                        <span className="text-[12px] font-medium leading-snug truncate">
                          {getTitle(n)}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// --- Root Wrapper ---

export default function App() {
  return (
    <>
      <SignedOut>
        <SignInGate />
      </SignedOut>
      <SignedIn>
        <OrgGate>
          <PlaybookProvider>
            <AppContent />
          </PlaybookProvider>
        </OrgGate>
      </SignedIn>
    </>
  );
}

// Splash screen for signed-out users
function SignInGate() {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-100 mb-6">O</div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-800 mb-2">Open Playbook</h1>
      <p className="text-sm text-slate-500 mb-8 max-w-md">
        Sign in to access your organization's operations playbook.
      </p>
      <SignInButton mode="modal">
        <button className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 uppercase tracking-widest">
          Sign In
        </button>
      </SignInButton>
    </div>
  );
}

// Gate that forces the user to have an active org before the app loads.
// Clerk's <OrganizationSwitcher> handles creating/selecting one.
function OrgGate({ children }: { children: React.ReactNode }) {
  const { organization, isLoaded } = useOrganization();
  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!organization) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-50 px-6">
        <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-100 mb-6">O</div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-800 mb-2">Choose or create an organization</h1>
        <p className="text-sm text-slate-500 mb-8 max-w-md text-center">
          Each organization gets its own private playbook workspace.
        </p>
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <CreateOrganization
            afterCreateOrganizationUrl="/"
            skipInvitationScreen={false}
          />
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

function AppContent() {
  const {
    profile,
    nodes,
    roots,
    loading,
    orgName,
    seed,
    isEditMode,
    setIsEditMode,
    saveDraft,
    publishDraft,
    favorites,
    toggleFavorite,
  } = usePlaybook();

  const [favoritesOpen, setFavoritesOpen] = useState(false);

  // Fallback to the seed admin so the UI renders before profile is fetched
  const currentUser = profile || mockUsers[0];

  const [selectedId, setSelectedId] = useState<string>('overview');
  const [selectedCategory, setSelectedCategory] = useState<string>('Overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({ query: '', tags: [] });
  const [kdfChoices, setKdfChoices] = useState<Record<string, string>>({});

  const categories = useMemo(() => Object.keys(roots), [roots]);

  const handleKdfSelect = (kdfId: string, choiceId: string) => {
    setKdfChoices(prev => {
      const isDeselect = prev[kdfId] === choiceId;
      return {
        ...prev,
        [kdfId]: isDeselect ? '' : choiceId 
      };
    });
  };

  const selectedNode = useMemo(() => getResolvedNode(selectedId, nodes), [selectedId, nodes]);

  const searchResults = useMemo(() => {
    if (!filters.query && filters.tags.length === 0 && !filters.subType) return [];
    return searchRegistry(filters, currentUser, nodes);
  }, [currentUser, filters, nodes]);

  // Dynamic breadcrumbs based on linear parent_id
  const breadcrumbs = useMemo(() => {
    const path: PlaybookDocumentUnion[] = [];
    let curr: string | undefined = selectedId;
    const visited = new Set(); // Prevent loops

    while (curr && !visited.has(curr)) {
      visited.add(curr);
      const node = nodes[curr];
      if (node) {
        path.unshift(node);
        curr = node.parent_id;
      } else {
        break;
      }
    }
    return path;
  }, [selectedId, nodes]);

  const sidebarRoots = useMemo(() => {
    const entryPoints = roots[selectedCategory] || [];
    if (entryPoints.length > 0) return entryPoints;

    return Object.values(nodes)
      .filter(node => {
        if (!hasPermission(currentUser, node, 'read')) return false;
        const nodeCats = getCategories(node);
        if (!nodeCats.includes(selectedCategory)) return false;

        // If it has a parent, check if the parent is also in this category
        if (node.parent_id) {
          const parentNode = getResolvedNode(node.parent_id, nodes);
          const parentCats = getCategories(parentNode);
          if (parentCats.includes(selectedCategory)) return false;
        }

        return true;
      })
      .map(node => node.entity_type === 'playbook' ? node.info.id : node.id);
  }, [selectedCategory, currentUser, nodes, roots]);

  // Sync selection if access is lost
  useEffect(() => {
    if (!hasPermission(currentUser, selectedNode, 'read')) {
      const firstRoot = sidebarRoots[0] || Object.keys(nodes)[0];
      if (firstRoot) setSelectedId(firstRoot);
    }
  }, [currentUser, selectedNode, sidebarRoots, nodes]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Open Playbook...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#f8fafc] text-slate-900 font-sans overflow-hidden">
      {/* Header Navigation */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-30 shadow-sm shadow-slate-100">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-100">O</div>
            <h1 className="text-lg font-bold tracking-tight text-slate-800 shrink-0">
              Open Playbook
              {orgName && (
                <span className="text-slate-400 font-normal"> · {orgName}</span>
              )}
            </h1>
          </div>

          <div className="hidden md:flex items-center w-96 relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Global Search (All Categories)..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all"
              onFocus={() => {
                setFilters({ ...filters, category: undefined });
                setShowSearchModal(true);
              }}
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Editor Mode Control */}
          {profile && hasPermission(profile, selectedNode, 'update') && (
            <div className="flex items-center gap-4 border-r border-slate-200 pr-4">
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Editor Mode</span>
                <button 
                  onClick={() => setIsEditMode(!isEditMode)}
                  className={`relative w-10 h-5 rounded-full transition-all duration-300 focus:outline-none ${isEditMode ? 'bg-indigo-600 shadow-[0_0_10px_rgba(79,70,229,0.3)]' : 'bg-slate-200'}`}
                >
                  <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-300 ${isEditMode ? 'translate-x-5' : ''}`} />
                </button>
              </div>
              {isEditMode && selectedNode.draft && (
                <button 
                  onClick={() => {
                    if (window.confirm('Publish these changes to the live version?')) {
                      publishDraft(selectedId, 'Updated via BOS Editor');
                    }
                  }}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black rounded-lg transition-all shadow-lg shadow-emerald-100 uppercase tracking-widest flex items-center gap-1.5 animate-in fade-in zoom-in"
                >
                  <Check className="w-3 h-3" />
                  Publish
                </button>
              )}
            </div>
          )}

          {/* Auth Controls — Clerk */}
          <div className="flex items-center gap-4">
            <OrganizationSwitcher
              afterCreateOrganizationUrl="/"
              afterSelectOrganizationUrl="/"
              hidePersonal
            />
            {profile && (
              <div className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-bold uppercase tracking-widest border border-indigo-100">
                {profile.role}
              </div>
            )}
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar Navigation */}
        <aside 
          className={`${
            sidebarOpen ? 'w-64' : 'w-0'
          } bg-white border-r border-slate-200 transition-all duration-300 overflow-hidden flex flex-col shrink-0 z-20`}
        >
          <div className="p-3 border-b border-slate-100 flex items-center justify-between">
            <div className="relative group flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input
                type="text"
                placeholder="Search playbooks..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                value={filters.query}
                onChange={(e) => setFilters({ ...filters, query: e.target.value })}
              />
            </div>
            {currentUser.role === 'Administrator' && (
              <button
                onClick={() => {
                  if (window.confirm('Seed this organization with the default blok playbook content? This will only insert nodes that do not already exist.')) {
                    seed().catch(err => alert('Seed failed: ' + err.message));
                  }
                }}
                title="Seed organization with blok playbook content"
                className="ml-2 p-2 hover:bg-slate-100 rounded transition-colors"
              >
                <Settings className="w-3.5 h-3.5 text-slate-400" />
              </button>
            )}
          </div>

          <WikiSidebar
            roots={roots}
            nodes={nodes}
            selectedId={selectedId}
            onSelect={setSelectedId}
            user={currentUser}
            searchQuery={filters.query}
          />
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50/50 relative">
          <header className="h-10 bg-white/50 backdrop-blur-sm flex items-center px-8 border-b border-slate-100/30 z-10 shrink-0">
            <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap">
              {breadcrumbs.map((p, i) => (
                <div key={(p as any).id || (p as PlaybookDocument).info.id} className="flex items-center gap-2">
                  <span 
                    onClick={() => setSelectedId((p as any).id || (p as PlaybookDocument).info.id)}
                    className={`text-[10px] font-bold tracking-tight cursor-pointer hover:text-indigo-600 transition-colors uppercase ${
                      i === breadcrumbs.length - 1 ? 'text-slate-800' : 'text-slate-300'
                    }`}
                  >
                    {getTitle(p)}
                  </span>
                  {i < breadcrumbs.length - 1 && <ChevronRight className="w-3 h-3 text-slate-200 shrink-0" />}
                </div>
              ))}
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-8 py-8 md:px-12 md:py-10 custom-scrollbar">
            <div className="max-w-[1600px] mx-auto">
              <AnimatePresence mode="wait">
                {selectedNode.entity_type === 'playbook' ? (
                  <RecursivePlaybookRenderer 
                    key={`${currentUser.id}-${selectedId}-${Object.values(kdfChoices).join('')}`} 
                    playbook={selectedNode as PlaybookDocument} 
                    onSelect={setSelectedId} 
                    user={currentUser}
                    depth={0}
                    kdfChoices={kdfChoices}
                    onKdfSelect={handleKdfSelect}
                    onCategorySelect={setSelectedCategory}
                    registry={nodes}
                  />
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="space-y-6"
                  >
                    <header className="pb-6 border-b border-amber-100">
                      <div className="flex items-center gap-2 text-amber-600 mb-2">
                        <ShieldAlert className="w-5 h-5" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Business Rule</span>
                      </div>
                      <h1 className="text-4xl font-black tracking-tight text-slate-800 leading-none">{getTitle(selectedNode)}</h1>
                    </header>
                    
                    <div className="max-w-[1600px] mx-auto space-y-6">
                      <FactorTreeItem 
                        factor={selectedNode as FactorDocument}
                        onSelect={setSelectedId}
                        onKdfSelect={handleKdfSelect}
                        onCategorySelect={setSelectedCategory}
                        kdfChoices={kdfChoices}
                        user={currentUser}
                        depth={0}
                        registry={nodes}
                      />
                    </div>
                    {/* Cross-References / Used In Section */}
                    {(((selectedNode as any).references) && 
                      ((selectedNode as any).references!.length > 0)) && (
                      <div className="mt-12 pt-8 border-t border-slate-100">
                        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                           <LayoutDashboard className="w-3 h-3 text-indigo-400" /> Cross-References / Used In
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {(selectedNode as any).references!.map((refId: string) => {
                            const refNode = getResolvedNode(refId, nodes);
                            return (
                              <div 
                                key={refId}
                                onClick={() => setSelectedId(refId)}
                                className="p-4 bg-white border border-slate-100 rounded-xl flex items-center justify-between cursor-pointer hover:border-indigo-200 transition-all group"
                              >
                                <div className="flex flex-col">
                                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                    {refNode.entity_type === 'playbook' ? (refNode as PlaybookDocument).info.categories.join(', ') : 'Rule'}
                                  </span>
                                  <span className="text-sm font-bold text-slate-700 group-hover:text-indigo-600">{getTitle(refNode)}</span>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400" />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </main>

        {/* Search Modal */}
        <AnimatePresence>
          {showSearchModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setShowSearchModal(false)}
            >
              <motion.div 
                initial={{ scale: 0.95, y: -20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: -20 }}
                className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 border-b border-slate-100 flex items-center gap-3">
                  <Search className="w-5 h-5 text-indigo-500" />
                  <input 
                    type="text" 
                    autoFocus
                    placeholder="Search by name, tags, or content..." 
                    className="flex-1 bg-transparent border-none focus:outline-none text-slate-800 font-medium"
                    value={filters.query}
                    onChange={(e) => setFilters({ ...filters, query: e.target.value })}
                  />
                  <button onClick={() => setShowSearchModal(false)}>
                    <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
                  </button>
                </div>

                <div className="p-4 bg-slate-50 flex gap-6 overflow-x-auto whitespace-nowrap custom-scrollbar">
                   <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Category:</span>
                    {['Operations', 'Logistics', 'Compliance', 'Structural'].map(cat => (
                      <button 
                        key={cat}
                        onClick={() => setFilters({ ...filters, category: filters.category === cat ? undefined : cat })}
                        className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${
                          filters.category === cat ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-500'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  <div className="w-px h-6 bg-slate-200" />
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dept:</span>
                    {['Management', 'Field Ops', 'Engineering'].map(dept => (
                      <button 
                        key={dept}
                        onClick={() => setFilters({ ...filters, department: filters.department === dept ? undefined : dept })}
                        className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${
                          filters.department === dept ? 'bg-amber-500 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-500'
                        }`}
                      >
                        {dept}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="max-h-[60vh] overflow-y-auto p-4 custom-scrollbar">
                  {searchResults.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                      <LayoutDashboard className="w-12 h-12 mx-auto mb-2 opacity-20" />
                      <p className="text-sm font-medium">No results found</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                       {searchResults.map(result => (
                        <div 
                          key={(result as any).id || (result as PlaybookDocument).info.id}
                          onClick={() => {
                            setSelectedId((result as any).id || (result as PlaybookDocument).info.id);
                            setShowSearchModal(false);
                          }}
                          className="p-4 rounded-xl border border-slate-100 hover:border-indigo-500 hover:bg-indigo-50/30 transition-all cursor-pointer group"
                        >
                          <div className="flex justify-between items-start">
                             <div>
                                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${result.entity_type === 'playbook' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>
                                  {result.entity_type}
                                </span>
                                <h3 className="text-sm font-bold mt-1 text-slate-800">{getTitle(result)}</h3>
                             </div>
                             <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Right Pane — Favorites (collapses to a thin rail) */}
        <aside
          className={`hidden xl:flex bg-white border-l border-slate-200 shrink-0 flex-col overflow-hidden transition-[width] duration-300 ease-out ${
            favoritesOpen ? 'w-64' : 'w-10'
          }`}
        >
          {favoritesOpen ? (
            <>
              <button
                onClick={() => setFavoritesOpen(false)}
                title="Collapse favorites"
                className="flex items-center justify-between w-full px-5 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Star className="w-3.5 h-3.5 text-amber-500" fill="currentColor" />
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                    Favorites
                  </span>
                  {favorites.length > 0 && (
                    <span className="text-[10px] font-bold text-slate-400">
                      {favorites.length}
                    </span>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <div className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
                {favorites.length === 0 ? (
                  <div className="p-4 text-center">
                    <Star className="w-6 h-6 mx-auto mb-2 text-slate-200" />
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Tap the star on any playbook to add it here.
                    </p>
                  </div>
                ) : (
                  favorites
                    .map(id => nodes[id])
                    .filter(Boolean)
                    .map(node => {
                      const id = node.entity_type === 'playbook' ? node.info.id : node.id;
                      const title = getTitle(node);
                      const cat = getCategories(node)[0];
                      const isSelected = id === selectedId;
                      return (
                        <div
                          key={id}
                          className={`group flex items-start gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-indigo-50 text-indigo-800'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                          onClick={() => {
                            if (cat) setSelectedCategory(cat);
                            setSelectedId(id);
                          }}
                        >
                          <BookOpen
                            className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                              isSelected ? 'text-indigo-500' : 'text-slate-300'
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            {cat && (
                              <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-tight mb-0.5">
                                {cat}
                              </span>
                            )}
                            <span className="block text-[12px] font-semibold leading-tight truncate">
                              {title}
                            </span>
                          </div>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              toggleFavorite(id);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-slate-400 hover:text-red-500"
                            title="Remove from favorites"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })
                )}
              </div>
            </>
          ) : (
            <button
              onClick={() => setFavoritesOpen(true)}
              title={`Show favorites${favorites.length ? ` (${favorites.length})` : ''}`}
              className="flex flex-col items-center justify-start gap-2 w-full h-full pt-4 hover:bg-slate-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-slate-400" />
              <Star
                className="w-4 h-4 text-amber-500"
                fill={favorites.length > 0 ? 'currentColor' : 'none'}
              />
              {favorites.length > 0 && (
                <span className="text-[10px] font-bold text-slate-500">{favorites.length}</span>
              )}
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}
