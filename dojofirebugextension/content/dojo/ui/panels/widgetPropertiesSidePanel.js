/* Released under BSD license (see license.txt) */
/*
 * Copyright IBM Corporation 2010, 2010. All Rights Reserved. 
 * U.S. Government Users Restricted Rights -  Use, duplication or disclosure restricted by GSA ADP 
 * Schedule Contract with IBM Corp. 
 */


/**
 * The panels main file (UI) of this extension
 * @author preyna@ar.ibm.com
 * @author fergom@ar.ibm.com
 */
define([
        "firebug/firebug",
        "firebug/lib/object",
        "firebug/lib/trace",
        "dojo/ui/messageBox",
        "dojo/ui/panels/panelCommons"
       ], function dojoPanelsFactory(Firebug, Obj, FBTrace, MessageBox, DojoPanels)
{

/**
 * @panel Widget Properties Side Panel.
 * This side panel displays the dojo highlevel properties for the selected widget. 
 */
var WidgetPropertiesSidePanel = function(){};
WidgetPropertiesSidePanel.prototype = Obj.extend(DojoPanels.SimplePanelPlusMixin,
{
    name: "widgetPropertiesSidePanel",
    title: DojoPanels.$STR('panel.widgetProperties.title'),
    parentPanel: DojoPanels.mainPanelName,
    order: 5,
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
        var dojoAccessor = DojoPanels.getDojoAccessor(DojoPanels._safeGetContext(this));
        return (dojoAccessor && dojoAccessor.isWidgetObject(object)) ? 2000 : 0;
    },

    updateSelection: function(widget) {
        if(this.supportsObject(widget)) {
            var context = DojoPanels._safeGetContext(this);
            var dojoAccessor = DojoPanels.getDojoAccessor(context);
            var objectToDisplay = dojoAccessor.getSpecificWidgetProperties(widget, context);
            Firebug.DOMPanel.DirTable.tag.replace( { object: objectToDisplay }, this.panelNode);
        } else {
            MessageBox.Messages.infoTag.replace({object: DojoPanels.$STR('warning.objectIsNotAWidget')}, this.panelNode);
        }
    }

});


/***********************************************************************************************************************/

// ***************************************************************
// exported classes
// ***************************************************************    
    DojoPanels.WidgetPropertiesSidePanel = WidgetPropertiesSidePanel;

    
    return WidgetPropertiesSidePanel;
});
