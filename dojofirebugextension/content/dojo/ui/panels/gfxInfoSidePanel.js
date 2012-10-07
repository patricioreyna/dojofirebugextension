/* Released under BSD license (see license.txt) */
 

/**
 * DojoInfo side panel
 * @author preyna@ar.ibm.com
 */
define([
        "firebug/firebug",
        "firebug/lib/dom",
        "firebug/lib/object",
        "firebug/lib/trace",
        "dojo/core/dojoaccess",
        "dojo/core/dojomodel",
        "dojo/ui/dojoreps",
        "dojo/ui/messageBox",
        "dojo/ui/panels/panelCommons"
       ], function gfxInfoPanelsFactory(Firebug, Dom, Obj, FBTrace, DojoAccess, DojoModel, DojoReps, MessageBox, DojoPanels)
{

/**
 * @panel GFX Info Side Panel. 
 */
var GfxInfoSidePanel = function() {};
GfxInfoSidePanel.prototype = Obj.extend(Firebug.Panel,
{
    name: "gfxInformationSidePanel",
    title: DojoPanels.$STR('panel.gfxInformationSidePanel.title'),
    parentPanel: DojoPanels.gfxMainPanelName,
    order: 1,
    enableA11y: true,
    deriveA11yFrom: "console",
    editable: false,
    
    initialize: function() {
        Firebug.Panel.initialize.apply(this, arguments);
        DojoPanels.addStyleSheet(this.document);
    },

    /**
     * Returns a number indicating the view's ability to inspect the object.
     * Zero means not supported, and higher numbers indicate specificity.
     */
    supportsObject: function(object, type) {
        var context = DojoPanels._safeGetContext(this);
        var dojoAccessor = DojoPanels.getDojoAccessor(context);
        return (dojoAccessor && dojoAccessor.isGfxSurface(object, context)) ? 6000 : 0;
    },

    updateSelection: function(shape) {
        shape = DojoPanels._safeGetContext(this).dojo.dojoExtensionSelection_gfx;

        if(this.supportsObject(shape)) {
            var context = DojoPanels._safeGetContext(this);
            var dojoAccessor = DojoPanels.getDojoAccessor(context);
            var renderer = dojoAccessor.getRenderer(context);
            var surfaceProps = dojoAccessor.getGfxSurfaceProperties(shape, context);
        
            var objectToDisplay = { 'renderer': renderer, 'surface': surfaceProps };
            Firebug.DOMPanel.DirTable.tag.replace( { object: objectToDisplay }, this.panelNode);
        } else {
            MessageBox.Messages.infoTag.replace({object: DojoPanels.$STR('warning.objectIsNotASurface')}, this.panelNode);
        }
    }    
    
});



//****************************************************************
//SIDE PANELS (END)
//****************************************************************
    
    
/***********************************************************************************************************************/

    // ***************************************************************
    // exported classes
    // ***************************************************************    

    DojoPanels.GfxInfoSidePanel = GfxInfoSidePanel;
    
    return GfxInfoSidePanel;
});
