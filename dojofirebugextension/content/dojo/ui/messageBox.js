/* Released under BSD license (see license.txt) */
/*
 * Copyright IBM Corporation 2010, 2010. All Rights Reserved. 
 * U.S. Government Users Restricted Rights -  Use, duplication or disclosure restricted by GSA ADP 
 * Schedule Contract with IBM Corp. 
 */


/**
 * Message box classes
 * @author preyna@ar.ibm.com
 * @author fergom@ar.ibm.com
 */
define([
        "firebug/firebug",
        "firebug/lib/css",
        "firebug/lib/dom",
        "firebug/lib/domplate",
        "dojo/ui/ui"
       ], function messageBoxFactory(Firebug, Css, Dom, Domplate, UI)
{

     
// ***************************************************************     
     
     /**
      * This class admin the a message box.
      */
     var ActionMessageBox = function(id, parentNode, msg, btnName, action) {
         // Message box identifier
         this._actionMessageBoxId = "actionMessageBoxId-" + id; 
         
         // The parentNode
         this._parentNode = parentNode; 
         
         // The message
         this._message = msg;
         
         // The button message
         this._btnName = btnName;
         
         // The action
         this._action = action;
     };
     ActionMessageBox.prototype = {

             /**
          * Load the message box in the parentPanel
          * @param visibility boolean that define if the box should be visible or not.
          */
         loadMessageBox: function(visibility){
             this.Template.tag.append({actionMessageBoxId: this._actionMessageBoxId,
                                               visibility: this._getVisibilityValue(visibility),
                                               message: this._message, btnName: this._btnName,
                                               actionMessageBox: this}, this._parentNode);
         },
         
         /**
          * Show the message box (if it exist).
          */
         showMessageBox: function(){
             this._setMessageBoxVisibility(true);
         },
         
         /**
          * Hide the message box (if it exist).
          */
         hideMessageBox: function(){
             this._setMessageBoxVisibility(false);
         },
         
         _getVisibilityValue: function(visibility){
             return UI.getVisibilityValue(visibility);
         },
         
         /**
          * Set message box visibility.
          */
         _setMessageBoxVisibility: function(visibility){
             // FIXME: Use $() function. Find out why this._parentNode has no getElementById method.
             //var msgbox = $(this._actionMessageBoxId, this._parentNode);
             //var msgbox = this._parentNode.firstElementChild;
             var msgbox = this._getMessageBox(this._parentNode, this._actionMessageBoxId);
             msgbox = (msgbox && (msgbox.id == this._actionMessageBoxId)) ? msgbox :null ;
             
             if (msgbox) { msgbox.style.display = this._getVisibilityValue(visibility); }
         },
         
         /**
          * Find the msg box.
          */
         _getMessageBox: function(parentNode, boxId){
             var children = parentNode.children;
             var int;
             for ( int = 0; int < children.length; int++) {
                 var child = children[int];
                 if (child.id == boxId) { 
                     return child;
                 }
             }
             return null;
         },
         
         /**
          * Execute the action.
          */
         executeAction: function(){
             this._action(this);
         }
     };
     
     //************************************************************************************************
     
     /**
      * Domplate template used to render message box's content.
      */
     with (Domplate) {
         //************************************************************************************************
         ActionMessageBox.prototype.Template = domplate({
             tag: 
                 DIV({"class": "dojo-warning", "id": "$actionMessageBoxId", "style": "display: $visibility"},
                     IMG({"src": 'chrome://dojofirebugextension/skin/info.png'}),
                     "$message",
                     INPUT({"type": "button", "value": "$btnName", "onclick": "$runAction", _actionMessageBox: "$actionMessageBox"})
                 ),
             runAction: function(event){
                 var actionMessageBox = event.target['actionMessageBox'];
                 actionMessageBox.executeAction();
             }
         });         

                  
         //************************************************************************************************
         /**
          * Messages template
          */
         var Messages = domplate({
             infoTag: DIV({"class": "infoMessage"}, "$object"),
             simpleTag: DIV({"class": "simpleMessage"}, "$object")
         });

     }
     
 // ***************************************************************
 // exported classes
 // ***************************************************************    

    UI.ActionMessageBox = ActionMessageBox;
    UI.Messages = Messages;
    
    return UI;
});
    