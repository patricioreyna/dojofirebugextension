/* Released under BSD license (see license.txt) */

/**
 * The panels main file (UI) of this extension
 * @author preyna@ar.ibm.com
 */
define([
        "firebug/firebug",
        "firebug/lib/object",
        "firebug/lib/trace",
        "dojo/ui/messageBox",
        "dojo/ui/panels/panelCommons"
       ], function gfxShapePropertiesPanelFactory(Firebug, Obj, FBTrace, MessageBox, DojoPanels)
{

/**
 * @panel GFX Shape Properties Side Panel.
 * This side panel displays the dojo highlevel properties for the selected shape. 
 */
var GfxShapePropertiesSidePanel = function(){};
GfxShapePropertiesSidePanel.prototype = Obj.extend(Firebug.Panel,
{
    name: "gfxShapePropertiesSidePanel",
    title: DojoPanels.$STR('panel.gfxShapeProperties.title'),
    parentPanel: DojoPanels.gfxMainPanelName,
    order: 2,
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
        var ctx = DojoPanels._safeGetContext(this);
        var dojoAccessor = DojoPanels.getDojoAccessor(ctx);
        return (dojoAccessor && dojoAccessor.isGfxShape(object, ctx)) ? 5000 : 0;
    },

    updateSelection: function(shape) {
        shape = DojoPanels._safeGetContext(this).dojo.dojoExtensionSelection_gfx;
        if(this.supportsObject(shape)) {
            var context = DojoPanels._safeGetContext(this);
            var dojoAccessor = DojoPanels.getDojoAccessor(context);
            var objectToDisplay = dojoAccessor.getGfxShapeProperties(shape, context);
            objectToDisplay._declaredClass = shape.declaredClass;
            Firebug.DOMPanel.DirTable.tag.replace( { object: objectToDisplay }, this.panelNode);
        } else {
            MessageBox.Messages.infoTag.replace({object: DojoPanels.$STR('warning.objectIsNotAShape')}, this.panelNode);
        }
    }

});


/***********************************************************************************************************************/

// ***************************************************************
// exported classes
// ***************************************************************    
    DojoPanels.GfxShapePropertiesSidePanel = GfxShapePropertiesSidePanel;

    
    return GfxShapePropertiesSidePanel;
});
