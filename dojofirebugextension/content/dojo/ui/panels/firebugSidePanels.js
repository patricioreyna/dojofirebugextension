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
       ], function otherFbugPanelsFactory(Firebug, Obj, FBTrace, MessageBox, DojoPanels)
{

/**
 * @panel DOM Side Panel.
 * This side panel shows the same info the the DOM panel shows for the selected object. 
 */
var DojoDOMSidePanel = function(){};
DojoDOMSidePanel.prototype = Obj.extend(Firebug.DOMBasePanel.prototype,
{
    name: "dojoDomSidePanel",
    title: "DOM",
    parentPanel: DojoPanels.mainPanelName,
    order: 9,
    enableA11y: true,
    deriveA11yFrom: "console",
    
    updateSelection: function(object) {
       if (DojoPanels._safeGetContext(this).dojoExtensionSelection) {
            return Firebug.DOMBasePanel.prototype.updateSelection.apply(this, arguments);
       }
    }

});

// ************************************************************************************************

/**
 * @panel HTML Side Panel.
 * This side panel shows the same info the the HTML panel shows for the selected object. 
 */
var DojoHTMLPanel = function(){};
DojoHTMLPanel.prototype = Obj.extend(Firebug.HTMLPanel.prototype,
{
    name: "dojoHtmlSidePanel",
    title: "HTML",
    parentPanel: DojoPanels.mainPanelName,
    order: 10,
    enableA11y: true,
    deriveA11yFrom: "console",

    initialize: function(context, doc) {
        Firebug.HTMLPanel.prototype.initialize.apply(this, arguments);
        DojoPanels.addStyleSheet(this.document);
    },

    show: function(state) {
        Firebug.HTMLPanel.prototype.show.apply(this, arguments);
        this.showToolbarButtons("fbHTMLButtons", false);
    },

    updateSelection: function(object) {
        var dojoPanelSelection = DojoPanels._safeGetContext(this).dojoExtensionSelection;
        // Verify if selected object is the same one that is setted in the dojo panel.
        if (dojoPanelSelection && 
            ((object == dojoPanelSelection) || (dojoPanelSelection['domNode'] == object))) {
            // Verify if the object is a widget in order to show the domNode info.
            var dojoAccessor = DojoPanels.getDojoAccessor(DojoPanels._safeGetContext(this));
            if (dojoAccessor.isWidgetObject(object)){
                this.select(object.domNode);
            } else {
                if (!object.nodeType){
                    MessageBox.Messages.infoTag.replace({object: DojoPanels.$STR('warning.noHTMLInfoForTheObject')}, this.panelNode);
                }
                return Firebug.HTMLPanel.prototype.updateSelection.apply(this, arguments);
            }
       }
    }
});

/***********************************************************************************************************************/

// ***************************************************************
// exported classes
// ***************************************************************    

    DojoPanels.DojoDOMSidePanel = DojoDOMSidePanel;
    DojoPanels.DojoHTMLPanel = DojoHTMLPanel;
    

    return DojoPanels;
});
