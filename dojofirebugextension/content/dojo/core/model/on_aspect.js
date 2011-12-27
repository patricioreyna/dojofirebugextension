/* Released under BSD license (see license.txt) */
/*
 * dojofirebugextension 
 * Copyright IBM Corporation 2010, 2010. All Rights Reserved. 
 * U.S. Government Users Restricted Rights -  Use, duplication or disclosure restricted by GSA ADP 
 * Schedule Contract with IBM Corp. 
 */


/**
 * dojo extension model. Basically the Tracker for connections and subscriptions (and all related
 * stuff)
 * @author preyna@ar.ibm.com
 * @author fergom@ar.ibm.com
 */

define([
        "firebug/lib/object",
        "firebug/lib/trace",
        "dojo/core/model/dojomodel",
        "dojo/core/proxies",
        "dojo/lib/collections",
        "dojo/lib/filtering"
       ], function onAspectObserverModelFactory(Obj, FBTrace, DojoModel, DojoProxies, Collections, DojoFilter)
{
    
     
    // EXPORTED EVENTS
    var ON_ONASPECTOBSERVER_ADDED = DojoModel.Tracker.ON_ONASPECTOBSERVER_ADDED = 'OnAspectObserver_added';
    var ON_ONASPECTOBSERVER_REMOVED = DojoModel.Tracker.ON_ONASPECTOBSERVER_REMOVED = 'OnAspectObserver_removed';
     
     
     // ***************************************************************
     
     /**
      * @class OnAspectObserver
      */
     var OnAspectObserver = function(target, type, listener, originalFunction, callerInfo){
        this.clazz = "OnAspectObserver";
        this.target = target;
        this.type = type;
        this.listener = listener;
        this.originalFunction = originalFunction; 
        this.callerInfo = callerInfo;        
     };
     OnAspectObserver.prototype = Obj.extend(DojoModel.AbstractObserver.prototype, {
         
         destroy: function() {
             delete this.clazz;
             delete this.target;
             delete this.type;
             delete this.listener;
             delete this.originalFunction;
             delete this.callerInfo;             
         },
         
         getEventFunction: function() {
             return DojoProxies.getDojoProxiedFunctionIfNeeded(this.originalFunction);
         },

         register: function(tracker, handle) {
             if(FBTrace.DBG_DOJO_DBG) {
                 FBTrace.sysout("DOJO DEBUG adding OnAspectObserver", [handle, this]);
             }
             
             // Add OnAspect to global list.
             if(!tracker.sharedSpace._allOnAspectObserversArray) {
                 tracker.sharedSpace._allOnAspectObserversArray = [];
             }
             tracker.sharedSpace._allOnAspectObserversArray.push(this);
             
             // Register incoming connection
             this._addOnAspectObserver(tracker.getTrackingInfoFor(this.target));
                          
             tracker.fireEvent(ON_ONASPECTOBSERVER_ADDED);
         },
         
         unregister: function(/*Tracker*/tracker, handle) {             
             if(FBTrace.DBG_DOJO_DBG) {
                 FBTrace.sysout("DOJO DEBUG removing OnAspectObserver", [handle, this]);
             }
             
             // remove OnAspect from global list.
             //FIXME performance
             tracker.sharedSpace._allOnAspectObserversArray.splice(tracker.sharedSpace._allOnAspectObserversArray.indexOf(this), 1);
             
             // Remove incoming connection
             this._removeOnAspectObserver(tracker.getTrackingInfoFor(this.target));
             tracker.trackingInfoDeleted(this.target);
             
             tracker.fireEvent(ON_ONASPECTOBSERVER_REMOVED);
         },

         _initializeTrackingInfo: function(trackingInfo) {
             if(!trackingInfo._onAspectObservers) {
                 //Dictionary<String|Function, [OnAspectObserver]>
                 trackingInfo._onAspectObservers = new Collections.ComposedDictionary();
                 trackingInfo._onAspectObserversCount = 0;                 
             }             
         },
         
         _addOnAspectObserver: function(trackingInfo) {
             this._initializeTrackingInfo(trackingInfo);
             
             var observers = trackingInfo._onAspectObservers.get(this.type);
             if (!observers){
                 observers = [];
                 trackingInfo._onAspectObservers.put(this.type, observers);
             }
             observers.push(this);
             trackingInfo._onAspectObserversCount++;
         },
         
         _removeOnAspectObserver: function(trackingInfo) {
             var arr = trackingInfo._onAspectObservers.get(this.type);
             arr.splice(arr.indexOf(this),1); //FIXME PERFORMANCE
             // Remove event if it has no associated connections.
             if (arr.length == 0) {
                 trackingInfo._onAspectObservers.remove(this.type);
             }            
             trackingInfo._onAspectObserversCount--;
             
             if(trackingInfo._onAspectObserversCount == 0) {
                 if(trackingInfo._onAspectObservers) { 
                     trackingInfo._onAspectObservers.destroy();
                 }
                 delete trackingInfo._onAspectObservers;
                 delete trackingInfo._onAspectObserversCount;
             }
         },
         
         /**
          * Return true if there are no registered connections.
          */
         /*boolean*/ isEmpty: function(trackingInfo) {
             return !trackingInfo._onAspectObserversCount || trackingInfo._onAspectObserversCount == 0;
         },
         

         /* 
          * ************************************************
          * ************************************************
          * OnAspectObserver STATIC METHODS
          * ************************************************
          * ************************************************
          */

         /**
          * Return true if there are any connection info registered for the object passed as parameter.
          * @param tracker
          * @param object The object.
          */
         /*boolean*/ areThereAnyOnAspectsFor: function(tracker, /*object*/object) {
             var trackingInfo = tracker.getTrackingInfoFor(object, true);
             return trackingInfo && !this.isEmpty(trackingInfo);
         },
         
         
         getGlobalOnAspectObserversCount: function(tracker) {
             var arr = tracker.sharedSpace._allOnAspectObserversArray;
             return arr ? arr.length : 0;
         },

         /**
          * @return array
          */         
         /*[OnAspectObserver]*/getGlobalOnAspectObservers: function(tracker) {
             return tracker.sharedSpace._allOnAspectObserversArray || [];
         },
         
         /**
          * Return the events with associated observers.
          * @return array
          */
         /*array*/getObservedEvents: function(trackingInfo) {
             if(!trackingInfo._onAspectObservers) {
                 return [];
             }             
             return trackingInfo._onAspectObservers.getKeys();
         },

         /**
          * @param type the type
          * @return array
          */
         /*array*/getOnAspectObserversForEvent: function(trackingInfo, type) {
             if(!trackingInfo._onAspectObservers) {
                 return [];
             }
             var obs = trackingInfo._onAspectObservers.get(type);
             return obs || [];
         },
         
         /*int*/ getOnAspectObserversCount: function(trackingInfo) {
             return trackingInfo._onAspectObserversCount;
         }
         
     });
          

    // ***************************************************************

    // ***************************************************************
    // exported classes
    // ***************************************************************    

    DojoModel.OnAspectObserver = OnAspectObserver;

    // ***************************************************************

    return DojoModel;
});