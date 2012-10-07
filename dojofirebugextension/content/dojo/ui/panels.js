/* Released under BSD license (see license.txt) */
/*
 * Copyright IBM Corporation 2010, 2010. All Rights Reserved. 
 * U.S. Government Users Restricted Rights -  Use, duplication or disclosure restricted by GSA ADP 
 * Schedule Contract with IBM Corp. 
 */


/**
 * The panels' loader main file (UI) of this extension
 * @author preyna@ar.ibm.com
 * @author fergom@ar.ibm.com
 */
define([
        "firebug/firebug",
        "firebug/chrome/firefox",
        "firebug/chrome/menu",
        "firebug/lib/object",
        "firebug/lib/trace",
        "dojo/core/dojoaccess",
        "dojo/core/dojofirebugextension",
        "dojo/ui/dojoreps",
        "dojo/ui/gfxreps",
        "dojo/ui/ui",
        "dojo/ui/panels/gfxMainPanel",
        "dojo/ui/panels/mainPanel",
        "dojo/ui/panels/panelCommons"
       ], function dojoPanelsFactory(Firebug, Firefox, Menu, Obj, FBTrace, DojoAccess, DojoExtension, DojoReps, GfxReps, UI, GfxPanel, DojoMainPanel, DojoPanels)
{

    //first: register the main panel
    DojoMainPanel.registerPanel();
    GfxPanel.registerPanel();
    
    
    //now, integrate with FF 's UI
    var UiIntegrator = {
            /**
             * listener method . Invoked when the Dojo Extension main Module is enabled 
             */
            onDojoExtensionEnabled: function() {
                //FF main context menu 
                this._registerContextMenuListener();
                
                //order is important!
                GfxReps.registerReps();
                DojoReps.registerReps();            
            },
            
            /**
             * listener method . Invoked when the Dojo Extension main Module is disabled 
             */
            onDojoExtensionDisabled: function() {

                GfxReps.unregisterReps();
                DojoReps.unregisterReps();
                

                //FF main context menu 
                this._unregisterContextMenuListener();        
            },
            
            
          
            // ********** firebug contextmenu inspect related methods
            
            _registerContextMenuListener: function() {
                // |this| must be this object        
                if(FBTrace.DBG_DOJO_CONTEXTMENU) {
                    FBTrace.sysout("DOJO - registering Firefox ContextMenu listener");
                }

                var contextMenu = Firebug.GlobalUI.$("contentAreaContextMenu");
                if (contextMenu) {
                    if(!this._boundOnContentAreaContextMenuShowing) {
                        this._boundOnContentAreaContextMenuShowing = Obj.bind(this._onContentAreaContextMenuShowing, this);
                    }
                    contextMenu.addEventListener("popupshowing", this._boundOnContentAreaContextMenuShowing, false);
                }
                if(FBTrace.DBG_DOJO_CONTEXTMENU) {
                    FBTrace.sysout("DOJO - Firefox ContextMenu listener " + ((contextMenu) ? "FOUND!" : "NOT FOUND!"));
                }
            },

            _unregisterContextMenuListener: function() {
                // |this| must be this object        
                if(FBTrace.DBG_DOJO_CONTEXTMENU) {
                    FBTrace.sysout("DOJO - unregistering Firefox ContextMenu listener");
                }

                var contextMenu = Firebug.GlobalUI.$("contentAreaContextMenu");        
                if (contextMenu) {
                    contextMenu.removeEventListener("popupshowing", this._boundOnContentAreaContextMenuShowing, false);
                } 
                if(FBTrace.DBG_DOJO_CONTEXTMENU) {
                    FBTrace.sysout("DOJO - Firefox ContextMenu listener " + ((contextMenu) ? "FOUND!" : "NOT FOUND!"));
                }
                
                var inspectItem = Firebug.GlobalUI.$("fbDojo_menu_dojofirebugextension_inspect");
                if(FBTrace.DBG_DOJO_CONTEXTMENU) {
                    FBTrace.sysout("DOJO - contextMenu InspectItem " + ((inspectItem) ? "FOUND!" : "NOT FOUND!"));
                }       
                
                if(inspectItem) {
                    inspectItem.hidden = true;    
                }

                //GFX
                var inspectItemGFX = Firebug.GlobalUI.$("fbDojo_menu_dojofirebugextension_inspect_GFX");
                if(FBTrace.DBG_DOJO_CONTEXTMENU) {
                    FBTrace.sysout("DOJO - contextMenu InspectItem GFX" + ((inspectItemGFX) ? "FOUND!" : "NOT FOUND!"));
                }       
                
                if(inspectItemGFX) {
                    inspectItemGFX.hidden = true;    
                }

            },
            
            _onContentAreaContextMenuShowing: function(event) {
                // |this| must be this panel
            
                if(FBTrace.DBG_DOJO_CONTEXTMENU) {
                    FBTrace.sysout("DOJO - _onContentAreaContextMenuShowing event", event);
                }

                var doc = event.target.ownerDocument;
                var elt = doc.popupNode;

                var inspectItem = Firebug.GlobalUI.$("fbDojo_menu_dojofirebugextension_inspect");
                if(!inspectItem) {
                    if(FBTrace.DBG_DOJO_CONTEXTMENU) {
                        FBTrace.sysout("DOJO - creating Dojo Inspect menu item: ", elt);
                    }

                    var contextMenu = Firebug.GlobalUI.$("contentAreaContextMenu"); 
                    var itemToCreate = { id: "fbDojo_menu_dojofirebugextension_inspect", label: UI.$STR("window.contextmenuitem.inspect"), nol10n: true, command: this.inspectFromContextMenu, hidden: true };
                    inspectItem = Menu.createMenuItem(contextMenu, itemToCreate);                        
                }
                var gfxInspectItem = Firebug.GlobalUI.$("fbDojo_menu_dojofirebugextension_inspect_GFX");
                if(!gfxInspectItem) {
                    if(FBTrace.DBG_DOJO_CONTEXTMENU) {
                        FBTrace.sysout("DOJO - creating Dojo Inspect GFX menu item: ", elt);
                    }

                    var contextMenu = Firebug.GlobalUI.$("contentAreaContextMenu"); 
                    var itemToCreateGFX = { id: "fbDojo_menu_dojofirebugextension_inspect_GFX", label: UI.$STR("window.contextmenuitem..gfx.inspect"), nol10n: true, command: this.inspectFromContextMenuGFX, hidden: true };
                    gfxInspectItem = Menu.createMenuItem(contextMenu, itemToCreateGFX);
                }


                var context = Firebug.TabWatcher.getContextByWindow(elt.ownerDocument.defaultView);
                if(!context) {
                    inspectItem.hidden = true;
                    gfxInspectItem.hidden = true;
                    return;
                }
                
                var dojo = DojoAccess._dojo(context);
                if(!dojo) {
                    inspectItem.hidden = true;
                    gfxInspectItem.hidden = true;
                } else {
                    try {
                        var gfxPanel = DojoExtension.ui.getDojoGFXPanel(context);
                        var isGFXElemSupported = gfxPanel && gfxPanel.supportsObject(elt); 
                        if(FBTrace.DBG_DOJO_CONTEXTMENU && isGFXElemSupported) {
                            FBTrace.sysout("DOJO - supported by GFX", elt);
                        }

                        var dojoPanel = DojoExtension.ui.getDojoPanel(context);
                        var isElemSupported = dojoPanel && dojoPanel.supportsObject(elt);
                        if(FBTrace.DBG_DOJO_CONTEXTMENU && isElemSupported) {
                            FBTrace.sysout("DOJO - supported by dojo main", elt);
                        }                    
                        inspectItem.hidden = !isElemSupported;
                        gfxInspectItem.hidden = !isGFXElemSupported;
                    } catch (e) {
                        FBTrace.sysout("DOJO ERROR - supported by GFX or main", e);   
                    }
                }    
            },

            /**
             * inspector related method
             */
            inspectFromContextMenu: function(event) {
                if(FBTrace.DBG_DOJO_CONTEXTMENU) {
                    FBTrace.sysout("DOJO - Inspect from contextMenu invoked: ", event);
                }            
                
                var elt = event.target.ownerDocument.popupNode;        

                var inspectingPanelName = DojoPanels.mainPanelName;
                
                Firebug.toggleBar(true, inspectingPanelName);
                Firebug.chrome.select(elt, inspectingPanelName);

                var panel = Firebug.chrome.selectPanel(inspectingPanelName);
                panel.panelNode.focus();
            },

            /**
             * inspector related method
             */
            inspectFromContextMenuGFX: function(event) {
                if(FBTrace.DBG_DOJO_CONTEXTMENU) {
                    FBTrace.sysout("DOJO - Inspect from GFX contextMenu invoked: ", event );
                }            
                
                var elt = event.target.ownerDocument.popupNode;

                var inspectingPanelName = DojoPanels.gfxMainPanelName;
                
                Firebug.toggleBar(true, inspectingPanelName);
                Firebug.chrome.select(elt, inspectingPanelName);

                var panel = Firebug.chrome.selectPanel(inspectingPanelName);
                panel.panelNode.focus();
            }            
            //end of firebug contextmenu inspect related methods
    };
    
    
    if(FBTrace.DBG_DOJO) {
        FBTrace.sysout("DOJO - adding panel's UiIntegrator as dojo Module Listener");
    }
    DojoExtension.dojofirebugextensionModel.addListener(UiIntegrator);
    
    
    
    return DojoPanels;
});
