/* Released under BSD license (see license.txt) */
/*
 * Copyright IBM Corporation 2010, 2010. All Rights Reserved. 
 * U.S. Government Users Restricted Rights -  Use, duplication or disclosure restricted by GSA ADP 
 * Schedule Contract with IBM Corp. 
 */


/**
 * UI helpers - Scrolling, highlight in panels, message boxes.
 * @author preyna@ar.ibm.com
 * @author fergom@ar.ibm.com
 */
define([
        "firebug/firebug",
        "firebug/lib/css",
        "firebug/lib/dom",
        "dojo/ui/ui"
       ], function dojoUIHelperFactory(Firebug, Css, Dom, UI)
{

    const Ci = Components.interfaces;
    const nsIInterfaceRequestor = Ci.nsIInterfaceRequestor;
    const nsISelectionDisplay = Ci.nsISelectionDisplay;
    const nsISelectionController = Ci.nsISelectionController;
    

 // ***************************************************************
    
    var getSelectionController = function(panel) {
        var browser = Firebug.chrome.getPanelBrowser(panel);
        return browser.docShell.QueryInterface(nsIInterfaceRequestor)
            .getInterface(nsISelectionDisplay)
            .QueryInterface(nsISelectionController);
    };

    /**
     * Scroll search found selection. 
     */
    var scrollSelectionIntoView = UI.scrollSelectionIntoView = function(panel) {
        var selCon = getSelectionController(panel);
        selCon.scrollSelectionIntoView(
                nsISelectionController.SELECTION_NORMAL,
                nsISelectionController.SELECTION_FOCUS_REGION, true);
    };

    

 // ****************************************************************
 // HELPER OBJECTS IN THIS NAMESPACE
 // ****************************************************************    
     var DomHighlightSelector = UI.DomHighlightSelector = function(){
         // The selectors
         this._selectors = [];
         
         /**
          * Add a selector.
          * @param className the class name to search
          * @param isSelection the function to identify the selection in the repObjects.
          */
         this.addSelector = function(/*String*/className, /*Function*/isSelection){
             this._selectors.push({
                 className: className,
                 isSelection: isSelection
             });
         };
         
         /**
          * This method highlight the selection in the parentNode element.
          * @param parentNode the node where the main panel info is contained.
          * @param selection the selection.
          * @param focus boolean to decide if the object should be focus
          */
         this.highlightSelection = function(parentNode, selection, /*boolean*/focus) {
             var occurrence;
             var firstOccurrence;
             var i;
             for (i = 0; i < this._selectors.length; i++) {
                 occurrence = this._highlightSelection(parentNode, selection, this._selectors[i].className, this._selectors[i].isSelection);
                 firstOccurrence = firstOccurrence || occurrence ;
             }
             if (focus && firstOccurrence) { Dom.scrollIntoCenterView(firstOccurrence); }
         };
                 
         /**
          * This function highlight the current dojo tab selection in the main panel.
          * @param parentNode the node where the main panel info is contained.
          * @param selection the selection.
          * @param className the class name to look the elements in the dom.
          * @param isSelection function that verify if an object is the selection.
          */
         this._highlightSelection = function(parentNode, selection, className, isSelection){
             var domElements = parentNode.getElementsByClassName(className);
             var node;
             var obj;
             var firstOccurrence;
             var i;
             for (i = 0; i < domElements.length; i++) {
                 node = domElements[i];
                 obj = node.referencedObject;
                 if (isSelection(selection, obj)){
                     firstOccurrence = firstOccurrence || node ;
                     Css.setClass(node, "currentSelection");
                 } else {
                     Css.removeClass(node, "currentSelection");
                 }
             }
             return firstOccurrence;
         };
     };
     
     
          
     
 // ***************************************************************
 // exported classes
 // ***************************************************************    

    UI.DomHighlightSelector = DomHighlightSelector;
    
    return UI;
});
    