/* Released under BSD license (see license.txt) */

 
/**
 * The main panel (UI) of this extension
 * @author preyna@ar.ibm.com
 */
define([
        "firebug/firebug",
        "firebug/lib/css",
        "firebug/lib/json",
        "firebug/lib/locale",
        "firebug/lib/object",
        "firebug/lib/search",
        "firebug/lib/string",
        "firebug/lib/trace",
        "dojo/core/dojofirebugextension",
        "dojo/core/dojomodel",
        "dojo/core/prefs",
        "dojo/lib/collections",
        "dojo/ui/gfxreps",
        "dojo/ui/ui",
        "dojo/ui/messageBox",
        "dojo/ui/uihelpers",
        "dojo/ui/panels/gfxInfoSidePanel",
        "dojo/ui/panels/gfxShapePropertiesSidePanel",
        "dojo/ui/panels/panelCommons"
       ], function gfxPanelsFactory(Firebug, Css, Json, Locale, Obj, Search, Str, FBTrace, DojoExtension, 
               DojoModel, DojoPrefs, Collections, GfxReps, UI, MessageBox, UiHelpers, GfxInfoSidePanel, GfxShapePropertiesSidePanel, DojoPanels)
{

 // ****************************************************************
    
    var getDojoAccessor = function(context) {
        return DojoPanels.getDojoAccessor(context);
    };

    /*context*/var _safeGetContext = function(panel) {
        return DojoPanels._safeGetContext(panel);
    };


    
    /**
     * Configuration for panel rendering. This object is used by the "updatePanelView" method
     * It basically dictates "what to refresh" in the UI
     */
    var PanelRenderConfig = function(/*boolean*/ refreshMainPanel, /*PanelView*/mainPanelView,
                                     /*boolean*/ highlight, /*boolean*/ scroll,
                                     /*boolean*/ refreshSidePanel, /*String*/sidePanelView){
        this.refreshMainPanel = refreshMainPanel;
        this.mainPanelView = mainPanelView;
        this.highlight = highlight;
        this.scroll = scroll;
        this.refreshSidePanel = refreshSidePanel;
        this.sidePanelView = sidePanelView;
        
        /**
         * Verify if the parameter view is the selected one.
         */
        this.isViewSelected = function(view){
            return (this.mainPanelView == view);
        };
    };
    PanelRenderConfig.VIEW_SHAPES = "view_shapes";
    
    

// ****************************************************************
// MAIN PANEL
// ****************************************************************

/**
 * @panel Main GFX dojo extension panel
 */
var gfxMainPanel = function() {};
gfxMainPanel.prototype = Obj.extend(Firebug.ActivablePanel,
{    
    name: DojoPanels.gfxMainPanelName,

    title: DojoPanels.$STR('panel.dojofirebugextensionPanel.gfx.title'),
    
    searchable: true,
    inspectable: true,
    inspectHighlightColor: "green",
    editable: false,
    structureModifiedMessageBox: null,

    /**
     * @override
     */
    initialize: function(context, doc) {
        Firebug.ActivablePanel.initialize.apply(this, arguments);
        
        this._initHighlighter(context);

        this._initMessageBoxes(context);                 
       
        DojoPanels.addStyleSheet(this.document);
    },

    
   _initMessageBoxes: function(ctx) {
       // Message boxes
       var self = this;
      
       /* Message box for on/aspects */
       var structureModifiedMsgBox = this.structureModifiedMessageBox = new MessageBox.ActionMessageBox("structureModifiedMessageBox", this.panelNode, 
                                                           DojoPanels.$STR('warning.gfx.structureModified'),
                                                           DojoPanels.$STR('warning.gfx.structureModified.button.update'),
                                                           function(actionMessageBox) {
                                                                actionMessageBox.hideMessageBox();
                                                                ctx.dojo.dojoExtensionSelection_gfx = undefined;
                                                                self.showInitialView(ctx);                                                                
                                                           });
       
       getDojoAccessor(ctx).addGFXListener(this, ctx);
   },

    /*
        listener method invoked each time the shapes structure is modified . It is used
        to avoid synch problems between page and our panels.
    */
    gfxStructureUpdated: function(container, context) {
        this.structureModifiedMessageBox.showMessageBox();
    },
    

    _initHighlighter: function(context) {
  
        this._domHighlightSelector = new UiHelpers.DomHighlightSelector();
        
        var dojoAccessor = getDojoAccessor(context);
        this._domHighlightSelector.addSelector("dojo-gfxshape", function(selection, shape) {        
            return dojoAccessor.areTheSameGfxObjects(selection, shape, context);
            //return selection == shape;
        });        
    },


    // **********  Inspector related methods ************************
    
    _configureInspectorSupport: function(/*bool*/on) {
        
        this.inspectable = on;        
    },
    
    /**
     * Highlight a node using the frame highlighter.
     * Overridden here to avoid changing dojo extension panel contents all the time.  
     * @param {Element} node The element to inspect
     */
    inspectNode: function(node) {
        return false;
    },
    
    stopInspecting: function(node, canceled) {
        if (canceled) {
            return;
        }

        this.select(node);        
    },

    /**
     * Called by the framework when inspecting is in progress. Allows to inspect
     * only nodes that are supported by the panel. Derived panels can provide effective
     * algorithms to provide these nodes.
     * @param {Element} node Currently inspected page element.
     */
    getInspectNode: function(node) {
        var context = _safeGetContext(this);
        var dojoAccessor = getDojoAccessor(context);

        var shape = dojoAccessor.getShapeFromNode(node, context);
        if (shape) {
            return node;
        }
        return null;
    },

    
    // **********  end of Inspector related methods ************************
    
    /**
     * This method shows the first view for a loaded page.
     */
    showInitialView: function(context) {
        this.showShapes(context);

        //show UI of selected side panel
        var sidePanel = Firebug.chrome.getSelectedSidePanel();
        if(sidePanel) {
            sidePanel.refresh();   
        }
    },

    /**
     * Refresh the panel.
     * @override
     */
     refresh: function() {
         var context = _safeGetContext(this);
                  
         this.showShapes(context);
     },
    
   /**
    * Returns a number indicating the view's ability to inspect the object.
    * Zero means not supported, and higher numbers indicate specificity.
    * @override
    */
   supportsObject: function(object, type) {
        if(FBTrace.DBG_DOJO) {
            FBTrace.sysout("DOJO GFX - supportsObject? ", object);
        }

       var context = _safeGetContext(this);
       var support = this.supportsActualObject(context, object, type);
       
       if(support == 0) {
           support = this.doesNodeBelongToShape(context, object, type);
       }

       if(FBTrace.DBG_DOJO) {
            FBTrace.sysout("DOJO GFX - supportsObject result:" + support);
        }


       return support;
    },
   
   
    /**
     * Support verification for actual object
     */
    supportsActualObject: function(context, object, type) {
        var dojoAccessor = getDojoAccessor(context);
        if (dojoAccessor.isGfxObject(object, context)){
            return 1;
        }
        return 0;       
    },

   /**
    * Support verification for a potential shape that contains the node.
    */
   /*int: 0|1*/doesNodeBelongToShape: function(context, object, type) {
        if(FBTrace.DBG_DOJO) {
            FBTrace.sysout("DOJO GFX - doesNodeBelongToShape ", object);
        }

        var dojoAccessor = getDojoAccessor(context);
        return dojoAccessor.doesNodeBelongToShape(object, context) ? 1 : 0;
   },
    
    /**
     * Return the path of selections shown in the extension toolbar.
     * @override
     */
    getObjectPath: function(object) {
         return [object];
    },
    
    /**
     * Highlight the found row.
     */
    highlightRow: function(row) {
        if (this.highlightedRow) {
            Css.cancelClassTimed(this.highlightedRow, "jumpHighlight", this.context);
        }

        this.highlightedRow = row;

        if (row){
            Css.setClassTimed(row, "jumpHighlight", this.context);
        }
    },
    
    /**
     * Panel search.
     * @override
     */
    search: function(text, reverse) {
        if (!text) {
            delete this.currentSearch;
            this.highlightRow(null);
            this.document.defaultView.getSelection().removeAllRanges();
            return false;
        }

        var row;
        if (this.currentSearch && text == this.currentSearch.text) {
            row = this.currentSearch.findNext(true, false, reverse, Firebug.Search.isCaseSensitive(text));
        } else {
            this.currentSearch = new Search.TextSearch(this.panelNode);
            row = this.currentSearch.find(text, reverse, Firebug.Search.isCaseSensitive(text));
        }

        if (row) {
            var sel = this.document.defaultView.getSelection();
            sel.removeAllRanges();
            sel.addRange(this.currentSearch.range);

            UiHelpers.scrollSelectionIntoView(this);
            this.highlightRow(row);

            return true;
        } else {
            this.document.defaultView.getSelection().removeAllRanges();
            return false;
        }
        
    },
    
    _showReloadBoxIfNeeded: function(context) { 
        // Verify if the context is consistent.
        if (DojoExtension.needsReload(context)) {
            /* Message box for Reload page */
            var conMsgBox = new MessageBox.ActionMessageBox("MsgBox", this.panelNode, 
                                                            DojoPanels.$STR('warning.pageNeedToBeReload'),
                                                            DojoPanels.$STR('warning.pageNeedToBeReload.button'),
                                                            function(actionMessageBox){
                                                                Firebug.currentContext.window.location.reload();
                                                            });
            conMsgBox.loadMessageBox(true);
        }
    },
    
    /**
     * Update panel view. Main "render" panel method
     * @param panelConfig the configuration
     * @param context the FB context
     */
    updatePanelView: function(/*PanelRenderConfig*/panelConfig, context){

        var selection = context.dojo.dojoExtensionSelection_gfx;
        var dojoAccessor = getDojoAccessor(context);
        
        //enable inspector based on widget existence
        this._configureInspectorSupport(dojoAccessor.hasSurfaces(context));

        
        //1st step: draw Main panel view.
        if (panelConfig.refreshMainPanel){
            // Clear the main panel
            this.panelNode.innerHTML = "";
             
            // Verify if the context is consistent.
            this._showReloadBoxIfNeeded(context);
            
            // Select the most suitable main panel to show the info about the selection
            this._renderShapes(context);            
        }
        
        // 2nd step: Highlight and Scroll the selection in the current view.
        this.highlightSelection(selection, panelConfig.highlight, panelConfig.scroll);
        
        // 3rd step: draw Side panel view
        if (panelConfig.refreshSidePanel) {
            if (panelConfig.sidePanelView) {
                Firebug.chrome.selectSidePanel(panelConfig.sidePanelView);
            } else {
                // Select the most suitable side panel to show the info about the selection.
                if(dojoAccessor.isGfxSurface(selection, context)){
                    Firebug.chrome.selectSidePanel(DojoPanels.GfxInfoSidePanel.prototype.name);
                } else {                
                    Firebug.chrome.selectSidePanel(DojoPanels.GfxShapePropertiesSidePanel.prototype.name);                
                }
            }
        }
    },
    
    /**
     * Firebug wants to show an object to the user and this panel has the best supportsObject() result for the object.
     * Should we also focus now a side panel?
     * @override
     */
    updateSelection: function(object) {

        var ctx = _safeGetContext(this);
        if (this.supportsActualObject(ctx, object) == 0) {
            if(FBTrace.DBG_DOJO) {
                FBTrace.sysout("GFX updateSelection NO support for actual object", object);
            }
            
           var dojoAccessor = getDojoAccessor(ctx);
           var shape = dojoAccessor.getShapeFromNode(object, ctx);
           if(!shape) {
                if(FBTrace.DBG_DOJO) {
                    FBTrace.sysout("GFX updateSelection NO shape from node", object);
                }
               return;
           }
           this.select(shape);

        } else {
            Firebug.ActivablePanel.updateSelection.call(this, object);
           
            if (!ctx.dojo.gfxSidePanelSelectionConfig) {
                this.updatePanelView(new PanelRenderConfig(/*refreshMainPanel*/true, /*mainPanelView*/null, /*highlight*/true, /*scroll*/true,
                                                          /*refreshSidePanel*/true, /*sidePanelView*/null), ctx);
            } else {
                this.updatePanelView(ctx.dojo.gfxSidePanelSelectionConfig, ctx);
            }        

        }
    },
    
    /**
     * This method highlight the selection in the main panel.
     * @param selection the selection.
     * @param focus boolean to decide if the object should be focus
     */
    highlightSelection : function(selection, /*boolean*/focus) {
        this._domHighlightSelector.highlightSelection(this.panelNode, selection, focus);
    },
    
    /**
     * This method show the object in the sidePanelName without changing the dojo main panel
     * @param object the object to show
     * @param sidePanelName the side panel where the object should be shown
     */
    updateSelectionAndSelectSidePanel : function(object, sidePanelName){
        var ctx = _safeGetContext(this);
        
        // Set in the context the render configurations.
        ctx.dojo.gfxSidePanelSelectionConfig = new PanelRenderConfig(/*refreshMainPanel*/false, /*mainPanelView*/null, /*highlight*/false, /*scroll*/false,
                                                             /*refreshSidePanel*/true, /*sidePanelView*/sidePanelName);
        Firebug.chrome.select(object, this.name, sidePanelName, true);
        // Clean from the context the render configurations.
        ctx.dojo.gfxSidePanelSelectionConfig = null;
    },
    
    /**
     * The select method is extended to force the panel update always.
     * @override 
     */
    select: function(object, forceUpdate) {
        var context = _safeGetContext(this);
        
        context.dojo.dojoExtensionSelection_gfx = object;
        Firebug.ActivablePanel.select.call(this, object, true);
    },    
    
    /**
     * returns panel's main menu items
     * @override
     */
    getOptionsMenuItems: function() {
        // {label: 'name', nol10n: true,  type: "checkbox", checked: <value>, command:function to set <value>}
        
        var context = _safeGetContext(this);
        return [
                { label: DojoPanels.$STR('label.Refresh'), nol10n: true, command: Obj.bindFixed(this.refresh, this) }
        ];
    },
            
    /**
     * Show the widget list.
     */
    showShapes: function(context) {
        this.updatePanelView(
                new PanelRenderConfig(/*refreshMainPanel*/true, /*mainPanelView*/PanelRenderConfig.VIEW_SHAPES, /*highlight*/true, /*scroll*/true,
                                      /*refreshSidePanel*/false, /*sidePanelView*/null), context);
    },
        
    /**
     * Render the Shapes tree list view
     * !Do not invoke this method directly. It must be just invoked from the updatePanelView method.
     */
    _renderShapes: function(context) {            
        var dojoAccessor = getDojoAccessor(context);
        var shapes = dojoAccessor.getShapeRoots(context);

        var areThereAnyShapes = shapes.length > 0; 
        if(!areThereAnyShapes) {
            MessageBox.Messages.infoTag.append({object: DojoPanels.$STR('warning.noshapes.msg1')}, this.panelNode);
            return false;
        }
        
        // Show the visual content.
        this.structureModifiedMessageBox.loadMessageBox(false);

        this._renderTreeForShapes(shapes, context);

        return areThereAnyShapes;
    },

    _renderTreeForShapes: function(shapes, context) {        
        try {
            var dojoAccessor = getDojoAccessor(context);
                        
            //get current GFX selection
            var selectionPath = [];
            var mainSelection = _safeGetContext(this).dojo.dojoExtensionSelection_gfx;
            var isGfxShape = mainSelection && dojoAccessor.isGfxObject(mainSelection, context); 
            if(isGfxShape) {
                selectionPath = dojoAccessor.getParentChain(mainSelection, shapes, context);
            }
            
            //create treeNodes for the root widgets            
            var treeRoots = GfxReps.ShapesTreeRep.createWrappersForShapes(shapes, selectionPath);

            GfxReps.ShapesTreeRep.tag.append({object: treeRoots, expandPath: selectionPath}, this.panelNode);

        } catch (e) {
            if(FBTrace.DBG_DOJO) {
                FBTrace.sysout("DOJO ERROR - _renderTreeForShapes ERROR", e);
            }            
        } 
    },

    /**
     * Support for panel activation.
     */
    onActivationChanged: function(enable)
    {
        if (enable) {
            DojoExtension.dojofirebugextensionModel.addObserver(this);
        } else {
            DojoExtension.dojofirebugextensionModel.removeObserver(this);
        }
    }

}); //end gfxMainPanel

    
/***********************************************************************************************************************/

// ***************************************************************
// exported classes
// ***************************************************************    

    DojoPanels.gfxMainPanel = gfxMainPanel; 
    
    /**
     * function to register this panel (and sidepanels) into Firebug engine
     */
    DojoPanels.gfxMainPanel.registerPanel = function() {
        Firebug.registerPanel(DojoPanels.gfxMainPanel);
        Firebug.registerPanel(DojoPanels.GfxInfoSidePanel);
        Firebug.registerPanel(DojoPanels.GfxShapePropertiesSidePanel);        
    };

    
// ***************************************************************
// exported static methods
// ***************************************************************    

    
    var _getDojoGFXPanel = function(context) {
        if(FBTrace.DBG_DOJO) {
            FBTrace.sysout("DOJO GFX - _getDojoGFXPanel ", context);
        }

        return context.getPanel(DojoPanels.gfxMainPanelName);
    };
    
    if(!Firebug.DojoExtension.ui) {
        Firebug.DojoExtension.ui = {};
    }
    Firebug.DojoExtension.ui.getDojoGFXPanel = _getDojoGFXPanel;

/***********************************************************************************************************************/
    
    return gfxMainPanel;
});
