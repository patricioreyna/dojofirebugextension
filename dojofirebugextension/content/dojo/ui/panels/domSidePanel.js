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
        "dojo/ui/panels/panelCommons"
       ], function otherFbugPanelsFactory(Firebug, Obj, DojoPanels)
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


/***********************************************************************************************************************/

// ***************************************************************
// exported classes
// ***************************************************************    

    DojoPanels.DojoDOMSidePanel = DojoDOMSidePanel;

// ***************************************************************

    return DojoDOMSidePanel;
});
