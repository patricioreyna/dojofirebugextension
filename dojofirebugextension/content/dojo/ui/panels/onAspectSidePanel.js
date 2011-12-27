/* Released under BSD license (see license.txt) */
/*
 * Copyright IBM Corporation 2010, 2010. All Rights Reserved. 
 * U.S. Government Users Restricted Rights -  Use, duplication or disclosure restricted by GSA ADP 
 * Schedule Contract with IBM Corp. 
 */


/**
 * On/Aspect observers side panel
 * @author preyna@ar.ibm.com
 * @author fergom@ar.ibm.com
 */
define([
        "firebug/firebug",
        "firebug/lib/object",
        "firebug/lib/trace",
        "dojo/core/dojomodel",
        "dojo/ui/dojoreps",
        "dojo/ui/messageBox",
        "dojo/ui/panels/panelCommons"
       ], function onAspectPanelsFactory(Firebug, Obj, FBTrace, DojoModel, DojoReps, MessageBox, DojoPanels)
{

//************************************************************************************************

/**
 * @panel OnAspectObserver Side Panel.
 * This side panel shows the On/Aspect information for the selected object. 
 */
var OnAspectSidePanel = function() {};
OnAspectSidePanel.prototype = Obj.extend(DojoPanels.SimplePanelPlusMixin,
{
    name: "onAspectObserversSidePanel",
    title: DojoPanels.$STR('panel.onAspectObservers.title'),
    parentPanel: DojoPanels.mainPanelName,
    order: 4,
    enableA11y: true,
    deriveA11yFrom: "console",
    //breakable: true,
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
        var api = DojoPanels._safeGetContext(this).tracker;
        return (api && DojoModel.OnAspectObserver.prototype.areThereAnyOnAspectsFor(api, object)) ? 2001 : 0;
    },

    /**
     * triggered when there is a Firebug.chrome.select() that points to the parent panel.
     */
    updateSelection: function(object) {        
        var api = DojoPanels._safeGetContext(this).tracker;
        var trackingInfo = (api) ? api.getTrackingInfoFor(object, true) : null;       
        
        if(trackingInfo && !DojoModel.OnAspectObserver.prototype.isEmpty(trackingInfo)) {
            DojoReps.OnAspectObserversArrayRep.tag.replace({ 'object': { 'object': object, 'trackingInfo': trackingInfo }}, this.panelNode);
        } else {
            MessageBox.Messages.infoTag.replace({'object': DojoPanels.$STR('warning.noOnAspectsInfoForTheObject')}, this.panelNode);
        }
    }
    
});

        
/***********************************************************************************************************************/

// ***************************************************************
// exported classes
// ***************************************************************    

    DojoPanels.OnAspectSidePanel = OnAspectSidePanel;
    

    return OnAspectSidePanel;
});
