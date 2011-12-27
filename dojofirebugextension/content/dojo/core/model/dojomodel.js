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
        "dojo/core/proxies",
        "dojo/lib/collections"
       ], function dojoModelFactory(Obj, FBTrace, DojoProxies, Collections)
{
    
    var DojoModel = {};
        
    // ***************************************************************
    
     /**
     * @class EventListenerSupportMixin
     * A Mixin for all those classes that want to provide event listening support to observers
     */
     var EventListenerSupportMixin = function(){};
     EventListenerSupportMixin.prototype = {
         
        // The listeners
        _eventsListeners: null,
        
        _getEventListeners: function() {
             if(this._eventsListeners == null) {
                 this._eventsListeners = {};
             }
             return this._eventsListeners;                 
         },
        
        addListener: function(/*String*/event, /*Function*/handler){
            var listeners = this._getEventListeners()[event];
            if (!listeners) {
                listeners = this._getEventListeners()[event] = [];
            }
            listeners.push(handler);
        },
        
        removeListener: function(/*String*/event, /*Function*/handler){
            var listeners = this._getEventListeners()[event];
            if (listeners) {
                var handlerIndex = listeners.indexOf(handler);
                if (handlerIndex != -1){
                    listeners.splice(handlerIndex, 1);
                }
            }
        },
        
        removeAllListeners: function(){
            var i;
            for (i in this._getEventListeners()){
                this._getEventListeners()[i].splice(0, this._getEventListeners()[i].length);
            }
        },
        
        fireEvent: function(/*String*/event, /*Arguments*/args){
            var listeners = this._getEventListeners()[event];
            if (listeners) {
                var i;
                for (i = 0; i < listeners.length; i++) {
                    listeners[i].apply(this, args);
                }
            }
        }
         
     };
     
    // ***************************************************************
    
    /**
      * @class Tracker
      */
     var Tracker = function(/*boolean*/ useHashCodeBasedDictionary){
         
         //new impl
         //a map holding Tracker Observers by handle . An Observer could be any of: Connection/Subscription/OnAspect/etc
         this._handles = (useHashCodeBasedDictionary) ? new Collections.ComposedDictionary() : new Collections.Dictionary();
         //a map holding TrackerInfo by sourceObject. Source object is a normal client app object , and trackingInfo contains the set of associated Observers
         this._sourceObjects = (useHashCodeBasedDictionary) ? new Collections.ComposedDictionary() : new Collections.Dictionary();
         //a shared space that can be used by specific impls to store values (for example, the array of all connection objects) (HACK)
         this.sharedSpace = {};
     };
     
     Tracker.prototype = Obj.extend(EventListenerSupportMixin.prototype, {

         destroy: function() {
             //destroy remaining observers
             var observers = this._handles.getValues();
             for ( var i = 0; i < observers.length; i++) {
                 observers[i].destroy();
             }
             observers = undefined;
             this._handles.destroy();
             delete this._handles;

             //a map holding TrackerInfo by sourceObject. Source object is a normal client app object , and trackingInfo contains the set of associated Observers
             this._sourceObjects.destroy();
             delete this._sourceObjects;
             
             delete this.sharedSpace;
             
             this.removeAllListeners();
         },
         
         trackObserver: function(handle, observer) {

             // Register the disconnect handle returned by dojo.connect.
             this._handles.put(handle, observer);

             //delegate registration to observer
             observer.register(this, handle);             
         },

         untrackObserver: function(handle) {
             var observer = this._handles.get(handle);

             if(FBTrace.DBG_DOJO_DBG_HANDLES) {
                 FBTrace.sysout("untrack handle called", [handle, observer]);
             }

             
             if(!observer) {
                 return;
             }
             // Remove from registered handles
             this._handles.remove(handle);
                        
             observer.unregister(this, handle);
         },
         
         /**
          * return an observer . An Observer could be any of: Connection/Subscription/OnAspect/etc
          */         
         /*Object*/getObserver: function(handle) {
             return this._handles.get(handle);
         },
         
         /**
          * return the trackingInfo related to the given source object.
          * Source object is a normal client app object , and TrackingInfo is an object containing the set of associated Observers
          */
         /*TrackingInfo*/getTrackingInfoFor: function(/*Object*/object, /*boolean(optional)*/doNotCreate) {
             var trackingInfo = this._sourceObjects.get(object);
             if (!trackingInfo && !doNotCreate){
                 trackingInfo = {};
                 //TODO stamp the source objects with a number or timestamp , to be able to compare them !
                 this._sourceObjects.put(object, trackingInfo);
             }
             return trackingInfo;
         },
         
         /**
          * used by impls to force a check of trackingInfo emptiness status (and thus removal from the global collection)
          */
         trackingInfoDeleted: function(/*Object*/sourceObj) {
             var trackingInfo = this._sourceObjects.get(sourceObj);
             
             if(FBTrace.DBG_DOJO_DBG) {                        
                 FBTrace.sysout("DOJO DEBUG: isEmpty trackingObject: ", [Object.keys(trackingInfo).length == 0, trackingInfo]);
             }
             if(this._isEmpty(trackingInfo)) {
                 this._sourceObjects.remove(sourceObj);
             }
         },

         //TODO move isEmpty method to trackingInfo class (if we create a class)         
         _isEmpty: function(trackingInfo) {
             //FIXME check if this logic is even working!
             return Object.keys(trackingInfo).length == 0;
         }
         
         
     }); //end of Tracker
     
     
     // ***************************************************************
     
     
     /**
      * An Observer. A tracked object that could be a connection, a subscription, an on/aspect or other.
      * All observers execute a listener function when fired  
      * @class AbstractObserver
      */
     var AbstractObserver = function(){};
     AbstractObserver.prototype = 
     {
             /**
              * returns the listener fn object.
              */
             getListenerFunction : function() {
                 var fn = null;
                 //HACK this is a hack. We are using knowledge from subclasses here
                 if(this.listener && typeof(this.listener) == "function") {
                     fn = this.listener;
                 } else if(this.method && typeof(this.method) == "function") {
                     fn = this.method;
                 } else if (this.context) {
                     fn = this.context[this.method];
                 }
                 
                 return this._getOriginalFunctionIfNeeded(fn);
             },

             _getOriginalFunctionIfNeeded : function(fn) {
                 return DojoProxies.getDojoProxiedFunctionIfNeeded(fn); 
             }    
     };
     
     // ***************************************************************
     // ***************************************************************     

     
     /**
      * @class EventListenerRegistrator
      * This utility class provide support to add and remove a set of registered listeners from an object
      * This class is used by our panels to ease the task of adding/removing a bulk set of observers  
      * TODO check if this class should be moved to other place
      */
     var EventListenerRegistrator = function(/*EventListenerSupportMixin*/ object, /*object*/listenersContext){
         // The object where the listeners will be register
         this.object = object;
         
         // Listeners.
         this.listeners = [];
         
         // The execution context for the listeners
         this.listenersContext = listenersContext || {};
         
         // Array to reference the delay handlers.
         this.timeOutFlags = [];
     };
     
     EventListenerRegistrator.prototype = {
             
         /**
          * This method set a property in the object that is used as execution context of the listeners.
          * @param property property name
          * @param value the value
          */
         setPropertyToListenersContext: function(/*String*/property, /*object*/value){
             this.listenersContext[property] = value;
         },
         
         /**
          * This method register a listener for an event.
          * @param event one or a list of events
          * @param listener the listener
          * @param timeout if the timeOut parameter is defined, the listener execution will be delayed this period of time, 
          * but in case that the same event is fire again before the execution is performed, the execution request is canceled
          * and a new one is created scheduled to be performed after the delay time were accomplished. 
          */
         registerListenerForEvent: function(/*String|Array<String>*/event, /*function*/listener, /*int*/timeOut){
             var events = (typeof(event) == 'string') ? [event] : event;
             var listenerFunc = this._attachListenerContext(listener, timeOut);
             var i;
             for (i = 0; i < events.length; i++) {
                 this.listeners.push({event: events[i], listener: listenerFunc});
             }
         },
         
         /**
          * This method add all the registered listeners to the object.
          */
         addAllListeners: function(){
             var list = null;
             var i;
             for (i = 0; i < this.listeners.length; i++){
                 list = this.listeners[i];
                 this.object.addListener(list.event, list.listener);
             }
         },
         
         /**
          * This method remove all the registered listeners to the object.
          */
         removeAllListeners: function(){
             var list = null;
             var i;
             for (i = 0; i < this.listeners.length; i++){
                 list = this.listeners[i];
                 this.object.removeListener(list.event, list.listener);
             }
         },
         
         /**
          * This method add all the registered listeners to the object.
          * @param listener the listener
          * @param timeOut delay time execute the listener
          * @return a function that execute the listener with the listenersContext object
          * as executionContext.
          */
         _attachListenerContext: function(listener, timeOut){
             var executionContext = this.listenersContext;
             if (timeOut) {
                 return this._wrappWithTimeOutFunction(listener, executionContext, timeOut);
             } else {
                 return function(){
                     listener.apply(executionContext, arguments);
                 };
             }
         },
         
         /**
          * This method generate and return a new function that execute the func with 
          * the executionContext once the timeOut is accomplished.
          */
         /*function*/ _wrappWithTimeOutFunction: function(func, executionContext, timeOut){
             var flagIndex = this.timeOutFlags.length;
             this.timeOutFlags.push({});
             var flags = this.timeOutFlags;
             return function(){
                 clearTimeout(flags[flagIndex]);
                 var args = arguments;
                 flags[flagIndex] = setTimeout(function(){func.apply(executionContext, args);}, timeOut);
             };
         }
     };
     
     
    // ***************************************************************
    // exported classes
    // ***************************************************************    

    DojoModel.EventListenerRegistrator = EventListenerRegistrator;           
    DojoModel.AbstractObserver = AbstractObserver;
    
    DojoModel.Tracker = Tracker;

    // ***************************************************************

    return DojoModel;
});