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
        "dojo/lib/collections",
        "dojo/lib/filtering"
       ], function dojoModelFactory(Obj, FBTrace, DojoProxies, Collections, DojoFilter)
{
    
    var DojoModel = {};
        
    // ***************************************************************
    
     /**
     * @class EventListenerSupport
     */
     var EventListenerSupport = function(){};
     EventListenerSupport.prototype = {
         
        // The events
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
     * @class EventsRegistrator
     * This class provide support to add and remove a set of registered listeners.  
     */
     //FIXME rename it
    var EventsRegistrator = DojoModel.EventsRegistrator = function(/*EventListenerSupport*/ object, /*object*/listenersContext){
        // The object where the listeners will be register
        this.object = object;
        
        // Listeners.
        this.listeners = [];
        
        // The execution context for the listeners
        this.listenersContext = listenersContext || {};
        
        // Array to reference the delay handlers.
        this.timeOutFlags = [];
    };
    
    EventsRegistrator.prototype = {
            
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

    /**
      * @class Connection API
      * TODO should be renamed to Tracker
      */
     var ConnectionsAPI = DojoModel.ConnectionsAPI = function(/*boolean*/ useHashCodeBasedDictionary){
         
         //new impl
         //a map holding Tracker Observers by handle . An Observer could be any of: Connection/Subscription/OnAspect/etc
         this._handles = (useHashCodeBasedDictionary) ? new Collections.ComposedDictionary() : new Collections.Dictionary();
         //a map holding TrackerInfo by sourceObject. Source object is a normal client app object , and trackingInfo contains the set of associated Observers
         this._sourceObjects = (useHashCodeBasedDictionary) ? new Collections.ComposedDictionary() : new Collections.Dictionary();
         //a shared space that can be used by specific impls to store values (for example, the array of all connection objects) (FIXME it's a hack)
         this.sharedSpace = {};
     };
     
     ConnectionsAPI.prototype = Obj.extend(EventListenerSupport.prototype, {

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
             
             if(FBTrace.DBG_DOJO) {                        
                 FBTrace.sysout("DOJO DEBUG: isEmpty trackingObject: ", [Object.keys(trackingInfo).length == 0, trackingInfo]);
             }
             if(this._isEmpty(trackingInfo)) {
                 this._sourceObjects.remove(sourceObj);
             }
         },

         //TODO move isEmpty method to trackingInfo class (if we create a class)
         _isEmpty: function(trackingInfo) {
             return Object.keys(trackingInfo).length == 0;
         }
         
         
     }); //end of ConnectionsAPI
     
     
     // Public Events supported by ConnectionsAPI.
     ConnectionsAPI.ON_CONNECTION_ADDED = 'connection_added';
     ConnectionsAPI.ON_CONNECTION_REMOVED = 'connection_removed';
     ConnectionsAPI.ON_SUBSCRIPTION_ADDED = 'subscription_added';
     ConnectionsAPI.ON_SUBSCRIPTION_REMOVED = 'subscription_removed';
     ConnectionsAPI.ON_ONASPECTOBSERVER_ADDED = 'OnAspectObserver_added';
     ConnectionsAPI.ON_ONASPECTOBSERVER_REMOVED = 'OnAspectObserver_removed';
     
     
     // ***************************************************************
     
     
     /**
      * @class FunctionLinkResolver
      */
     var FunctionLinkResolver = DojoModel.FunctionLinkResolver = function(){};
     FunctionLinkResolver.prototype = 
     {
             /**
              * returns the listener fn object.
              */
             getListenerFunction : function() {
                 var fn = null;
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
     
     /**
      * @class Connection
      */
     var Connection = DojoModel.Connection = function(obj, /*string|function*/event, context, method, originalFunction, dontFix, callerInfo) {
         this.clazz = "Connection";
         this.obj = obj;
         this.event = event;
         this.context = context;
         this.method = method;
         this.originalFunction = originalFunction;
         this.dontFix = dontFix;
         this.callerInfo = callerInfo;                
     };
     Connection.prototype = Obj.extend(FunctionLinkResolver.prototype, {
         
         /**
          * Destructor
          */
         destroy: function() {
             delete this.clazz;
             delete this.obj;
             delete this.event;
             delete this.context;
             delete this.method;
             delete this.originalFunction;
             delete this.dontFix;
             delete this.callerInfo;            
         },
               
         getEventFunction: function() {
            return DojoProxies.getDojoProxiedFunctionIfNeeded(this.originalFunction);
         },

         register: function(tracker, handle) {             
             if(FBTrace.DBG_DOJO_DBG) {                        
                 FBTrace.sysout("DOJO DEBUG: adding connection", [handle, this]);
             }             

             // Add connection to global list.
             if(!tracker.sharedSpace._allConnectionsArray) {
                 tracker.sharedSpace._allConnectionsArray = [];
             }
             tracker.sharedSpace._allConnectionsArray.push(this);
             
             // Register incoming connection
             this._registerIncomingConnection(tracker.getTrackingInfoFor(this.obj));
             
             // Register outgoing connection
             this._registerOutgoingConnection(tracker.getTrackingInfoFor(this.context));
             
             // Raise the onConnectionAdded event if there is registered handler.
             tracker.fireEvent(ConnectionsAPI.ON_CONNECTION_ADDED);
         },

         unregister: function(/*ConnectionsAPI*/tracker, handle) {
             
             if(FBTrace.DBG_DOJO_DBG) {                        
                 FBTrace.sysout("DOJO DEBUG: removing connection", [handle, this]);
             }             
             
             //Remove connection from global list.
             //FIXME performance
             tracker.sharedSpace._allConnectionsArray.splice(tracker.sharedSpace._allConnectionsArray.indexOf(this), 1);
             
             // Remove incoming connection
             this._unregisterIncomingConnection(tracker.getTrackingInfoFor(this.obj));
             tracker.trackingInfoDeleted(this.obj);
             
             // Remove outgoing connection
             this._unregisterOutgoingConnection(tracker.getTrackingInfoFor(this.context));
             tracker.trackingInfoDeleted(this.context);
             
             // Raised the onConnectionRemoved event if there is registered handler.
             tracker.fireEvent(ConnectionsAPI.ON_CONNECTION_REMOVED);
         },

         _initializeTrackingInfo: function(trackingInfo) {
             if(!trackingInfo._incomingConnections) {
                 //Incoming connections (Dictionary<String|Function, [Connection]>)
                 trackingInfo._incomingConnections = new Collections.ComposedDictionary();
                 trackingInfo._incomingConnectionsCount = 0;                 
             }
             
             if(!trackingInfo._outgoingConnections) {
                 //Outgoing connections (Dictionary<(String|Function), [Connection]>).
                 trackingInfo._outgoingConnections = new Collections.ComposedDictionary();
                 trackingInfo._outgoingConnectionsCount = 0;
             }
         },

         // Add new incoming connection.
         _registerIncomingConnection: function(trackingInfo) {
             this._initializeTrackingInfo(trackingInfo);
             
             var incConnections = trackingInfo._incomingConnections.get(this.event);
             if (!incConnections){
                 incConnections = [];
                 trackingInfo._incomingConnections.put(this.event, incConnections);
             }
             incConnections.push(this);
             trackingInfo._incomingConnectionsCount++;
         },
         
         // Add new outgoing connection.
         _registerOutgoingConnection: function(trackingInfo) {
             this._initializeTrackingInfo(trackingInfo);
             
             var outConnections = trackingInfo._outgoingConnections.get(this.method);
             if (!outConnections){
                 outConnections = [];
                 trackingInfo._outgoingConnections.put(this.method, outConnections);
             }
             outConnections.push(this);
             trackingInfo._outgoingConnectionsCount++;
         },
         
         // Remove incoming connection.
         _unregisterIncomingConnection: function(trackingInfo) {
             var arr = trackingInfo._incomingConnections.get(this.event);
             arr.splice(arr.indexOf(this),1); //FIXME PERFORMANCE
             // Remove event if it has no associated connections.
             if (arr.length == 0) {
                 trackingInfo._incomingConnections.remove(this.event);
             }            
             trackingInfo._incomingConnectionsCount--;
             
             if(trackingInfo._incomingConnectionsCount == 0) {
                 if(trackingInfo._incomingConnections) {
                     trackingInfo._incomingConnections.destroy();
                 }
                 delete trackingInfo._incomingConnections;
                 delete trackingInfo._incomingConnectionsCount;
             }
         },
         
         // Remove outgoing connection.
         _unregisterOutgoingConnection: function(trackingInfo){
             var arr = trackingInfo._outgoingConnections.get(this.method);
             arr.splice(arr.indexOf(this),1); //FIXME PERFORMANCE
             // Remove method if it has no associated connections.
             if (arr.length == 0) {
                 trackingInfo._outgoingConnections.remove(this.method);
             }             
             trackingInfo._outgoingConnectionsCount--;
             
             if(trackingInfo._outgoingConnectionsCount == 0) {
                 if(trackingInfo._outgoingConnections) {
                     trackingInfo._outgoingConnections.destroy();
                 }
                 delete trackingInfo._outgoingConnections;
                 delete trackingInfo._outgoingConnectionsCount;
             }
         },          
         
         /* 
          * ************************************************
          * ************************************************
          * CONNECTION STATIC METHODS
          * ************************************************
          * ************************************************
          */
         
         /**
          * Return the events with connections associated.
          * @return an array with the events with connections associated.
          */
         /*array*/getIncommingConnectionsEvents: function(trackingInfo) {
             if(!trackingInfo._incomingConnections) {
                 return [];
             }
             return trackingInfo._incomingConnections.getKeys();
         },

         /**
          * @param event the event
          * @return an array with the connections associated to the event passed as parameter.
          */
         /*array*/getIncommingConnectionsForEvent: function(trackingInfo, event) {
             if(!trackingInfo._incomingConnections) {
                 return [];
             }             
             var cons = trackingInfo._incomingConnections.get(event);
             return cons || [];
         },
         
         /**
          * Return the methods with connections associated.
          * @return an array with the methods with connections associated.
          */
         /*array*/getOutgoingConnectionsMethods: function(trackingInfo) {
             if(!trackingInfo._outgoingConnections) {
                 return [];
             }             
             return trackingInfo._outgoingConnections.getKeys();
         },
         
         /**
          * Return the connections associated to the method passed as parameter.
          * @param method the method
          * @return an array with the connections associated to the method passed as parameter.
          */
         /*array*/getOutgoingConnectionsForMethod: function(trackingInfo, method) {
             if(!trackingInfo._outgoingConnections) {
                 return [];
             }             
             var cons = trackingInfo._outgoingConnections.get(method);
             return cons || [];
         },
         
         /**
          * Return true if there are no registered connections.
          */
         /*boolean*/ isEmpty: function(trackingInfo) {
          return (!trackingInfo._incomingConnectionsCount || trackingInfo._incomingConnectionsCount == 0) && 
              (!trackingInfo._outgoingConnectionsCount || trackingInfo._outgoingConnectionsCount == 0);
         },
         
         /*int*/getIncommingConnectionsCount: function(trackingInfo) {
             return trackingInfo._incomingConnectionsCount;
         },

         /*int*/getOutgoingConnectionsCount: function(trackingInfo) {
             return trackingInfo._outgoingConnectionsCount;
         },
         
         /**
          * Return true if there are any connection info registered for the object passed as parameter.
          * @param tracker
          * @param object The object.
          */
         /*boolean*/ areThereAnyConnectionsFor: function(tracker, /*object*/object) {
             var trackingInfo = tracker.getTrackingInfoFor(object, true);
             return trackingInfo && !this.isEmpty(trackingInfo);
         },
         
         
         getGlobalConnectionsCount: function(tracker) {
             var arr = tracker.sharedSpace._allConnectionsArray;
             return arr ? arr.length : 0;
         },
         
         /**
          * Return an array with all the registered connections.
          * @param priorityCriteriaArray an array with the index of the connection properties 
          *        sorted by priority to sort a connections array. This parameter could be null.
          * Connection properties indexes:
          * this.ConnectionArraySorter.OBJ = 0;
          * this.ConnectionArraySorter.EVENT = 1;
          * this.ConnectionArraySorter.CONTEXT = 2;
          * this.ConnectionArraySorter.METHOD = 3;
          */
         /*Array<Connection>*/ getGlobalConnections: function(tracker, /*Object?*/filterArgs, /*Object*/ formatters, /*Array<int>?*/ priorityCriteriaArray) {
             
             var f = filterArgs;
             var theArray = tracker.sharedSpace._allConnectionsArray; 
                          
             if(f) {
                 //ok..user wants some filtering..
                 
                 /* query rules ("trying" to follow dojo's FileReadStore style):
                          no starting/ending braces allowed...
                          commas are ANDs
                          there are no ORs yet
                          e.g: obj:string, event:string,...
                          
                        obj: string , check by tostring regex match?
                        event: string, event name
                        context: string (check by tostnrg)
                        method: string , check by method name
                        
                    also: if the query is a simple string without a reference to obj, evet, context, method
                    then that query string will be compared against all those 4 properties
                    * you can set queryOptions too (like in dojo) 
                  */
                 if(f.query) {                     
                     theArray = DojoFilter.filter(f, theArray, formatters);
                 }
                 
                 //slice the resulting array if needed
                 var from = f.from || 0;
                 var count = (f.count && f.count <= theArray.length) ? f.count : theArray.length;  
                 if(from != 0 || count != theArray.length) {
                     var end = count;
                     //var end = (count + from <= theArray.length) ? count + from : theArray.length;
                     theArray = theArray.slice(from, end); 
                 }
             }         
    
            if (priorityCriteriaArray) {
                //FIXME change this by a timestmp or number "stamped" to the con.target and con.obj
                var sorter = new ConnectionArraySorter(this.getObjectsWithConnections(), priorityCriteriaArray);
                 var cons = sorter.sortConnectionArray(theArray);
                 return cons;
             
             } else {
                 return theArray;
             }
         }         
         
     });
     
     // ***************************************************************
     
     /**
      * @class Subscription
      */
     var Subscription = DojoModel.Subscription = function(topic, context, method, callerInfo){
        this.clazz = "Subscription";
        this.topic = topic;
        this.context = context;
        this.method = method;
        this.callerInfo = callerInfo;
     };
     Subscription.prototype = Obj.extend(FunctionLinkResolver.prototype, {
                 
         //used for passed in null contexts
         _subsGlobalCtx: "topics-global-context", 
         
         destroy: function() {
             delete this.clazz;
             delete this.topic;
             delete this.context;
             delete this.method;
             delete this.callerInfo;
         },
         
         _getIndexableContext: function() {
             return this.context || Subscription.prototype._subsGlobalCtx;
         },
         
         register: function(tracker, handle) {
             if(FBTrace.DBG_DOJO) {                        
                 FBTrace.sysout("DOJO DEBUG: adding subscription", [handle, this]);
             }            
             
             
             this._addSubToGlobalList(tracker);
             
             if(FBTrace.DBG_DOJO_DBG) {
                 FBTrace.sysout("new created Subs: ", subs);
                 FBTrace.sysout("subsForTopic value: ", subsForTopic);                 
             }

             // Register subscription
             var context = this._getIndexableContext(); //$HACK
             this._addSubscriptionToTrackingInfo(tracker.getTrackingInfoFor(context));
                                      
             // Raised the onSubscriptionAdded event if there is registered handler.
             tracker.fireEvent(ConnectionsAPI.ON_SUBSCRIPTION_ADDED);
         },
         
         unregister: function(/*ConnectionsAPI*/tracker, handle) {
             if(FBTrace.DBG_DOJO) {                        
                 FBTrace.sysout("DOJO DEBUG: removing subscription", [handle, this]);
             } 
             
             this._removeSubFromGlobalList(tracker);

             var subsContext = this._getIndexableContext(); //$HACK
             var trackingInfo = tracker.getTrackingInfoFor(subsContext);
             
             this._removeSubscriptionFromTrackingInfo(trackingInfo);           
             tracker.trackingInfoDeleted(subsContext);
                           
             // Raised the onSubscriptionRemoved event if there is registered handler.
             tracker.fireEvent(ConnectionsAPI.ON_SUBSCRIPTION_REMOVED);             
         },

         _addSubscriptionToTrackingInfo: function(trackingInfo) {
             this._initializeTrackingInfo(trackingInfo);
             
             trackingInfo._subscriptions.push(this);
         },

         _removeSubscriptionFromTrackingInfo: function(trackingInfo) {
             trackingInfo._subscriptions.splice(trackingInfo._subscriptions.indexOf(this),1);
             if(trackingInfo._subscriptions.length == 0) {
                 delete trackingInfo._subscriptions;
             }                          
         },

         _initializeTrackingInfo: function(trackingInfo) {
             if(!trackingInfo._subscriptions) {
                 // Subscriptions.
                 trackingInfo._subscriptions = [];
             }             
         },

         _addSubToGlobalList: function(tracker) {
             // Add subscription to global list.
             if(!tracker.sharedSpace._allSubscriptions) {
                 //_allSubscriptions : a map of (String, [Subscription])
                 tracker.sharedSpace._allSubscriptions = new Collections.StringMap();
                 tracker.sharedSpace._allSubscriptionsCount = 0;
             }
             
             var subsForTopic = tracker.sharedSpace._allSubscriptions.get(this.topic);
             if (!subsForTopic) {
                 subsForTopic = [];
                 tracker.sharedSpace._allSubscriptions.put(this.topic, subsForTopic);
             }
             subsForTopic.push(this);
             tracker.sharedSpace._allSubscriptionsCount++;
         },
         
         _removeSubFromGlobalList: function(tracker) {
             // Remove subscription from global list
             var subsForTopic = tracker.sharedSpace._allSubscriptions.get(this.topic);
             subsForTopic.splice(subsForTopic.indexOf(this),1);
             tracker.sharedSpace._allSubscriptionsCount--;
             if(subsForTopic.length == 0) {
                 tracker.sharedSpace._allSubscriptions.remove(this.topic);
             }             
         },

         /* 
          * ************************************************
          * ************************************************
          * SUBSCRIPTION STATIC METHODS
          * ************************************************
          * ************************************************
          */

         /**
          * factory method
          */
         createSubscription: function(topic, context, method, callerInfo) {
             return new Subscription(topic, context, method, callerInfo);
         },

         /**
          * factory method . used to create subscriptions from dojo 1.7's topic.js 
          */         
         createTopicSubscription: function(topic, listener, callerInfo) {
             return new Subscription(topic, null, listener, callerInfo);
         },

         /**
          * Return the subscriptions map.
          */
         /*StringMap(String,[Subscription])*/ getGlobalSubscriptions: function(tracker) {
             return tracker.sharedSpace._allSubscriptions || new Collections.StringMap();
         },
         
         /*int*/getGlobalSubscriptionsCount: function(tracker) {
             return tracker.sharedSpace._allSubscriptionsCount ? tracker.sharedSpace._allSubscriptionsCount : 0;
         },
         
         /**
          * Return the subscriptions list for the topic given as parameter.
          * @param topic The topic.
          */
         /*[Subscription]*/ getGlobalSubscriptionsForTopic: function(tracker, /*String*/topic) {
             return this.getGlobalSubscriptions(tracker).get(topic);
         },

         /**
          * Return true if there are any subscription info registered for the object passed as parameter.
          * @param object The object.
          */
         /*boolean*/ areThereAnySubscriptionFor: function(tracker, /*object*/object) {
             var trackingInfo = tracker.getTrackingInfoFor(object, true);
             return trackingInfo && !this.isEmpty(trackingInfo);
         },

         /*[Subscription]*/getSubscriptionsFrom: function(trackingInfo) {
             return trackingInfo._subscriptions;
         },
         
         /**
          * Return true if there are no registered subscriptions.
          */
         /*boolean*/ isEmpty: function(trackingInfo) {
          return !trackingInfo._subscriptions || trackingInfo._subscriptions.length == 0;
         }

     });
     
     // ***************************************************************
     
     /**
      * @class OnAspectObserver
      */
     var OnAspectObserver = DojoModel.OnAspectObserver = function(target, type, listener, originalFunction, callerInfo){
        this.clazz = "OnAspectObserver";
        this.target = target;
        this.type = type;
        this.listener = listener;
        this.originalFunction = originalFunction; 
        this.callerInfo = callerInfo;        
     };
     OnAspectObserver.prototype = Obj.extend(FunctionLinkResolver.prototype, {
         
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
             if(FBTrace.DBG_DOJO) {
                 FBTrace.sysout("DOJO DEBUG adding OnAspectObserver", [handle, this]);
             }
             
             // Add OnAspect to global list.
             if(!tracker.sharedSpace._allOnAspectObserversArray) {
                 tracker.sharedSpace._allOnAspectObserversArray = [];
             }
             tracker.sharedSpace._allOnAspectObserversArray.push(this);
             
             // Register incoming connection
             this._addOnAspectObserver(tracker.getTrackingInfoFor(this.target));
                          
             tracker.fireEvent(ConnectionsAPI.ON_ONASPECTOBSERVER_ADDED);
         },
         
         unregister: function(/*ConnectionsAPI*/tracker, handle) {             
             if(FBTrace.DBG_DOJO) {
                 FBTrace.sysout("DOJO DEBUG removing OnAspectObserver", [handle, this]);
             }
             
             // remove OnAspect from global list.
             //FIXME performance
             tracker.sharedSpace._allOnAspectObserversArray.splice(tracker.sharedSpace._allOnAspectObserversArray.indexOf(this), 1);
             
             // Remove incoming connection
             this._removeOnAspectObserver(tracker.getTrackingInfoFor(this.target));
             tracker.trackingInfoDeleted(this.target);
             
             tracker.fireEvent(ConnectionsAPI.ON_ONASPECTOBSERVER_REMOVED);
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
     
     /**
      * @class ConnectionArraySorter
      */
    //TODO: Add comment!
    var ConnectionArraySorter = DojoModel.ConnectionArraySorter = function (objectOrderArray, priorityCriteriaArray) {

        this.priorityCriteriaArray = priorityCriteriaArray;
        
        var criteriaObject = function(obj1, obj2){
            if (obj1 == obj2) {
                return 0;
            } else {
                return (objectOrderArray.indexOf(obj1) < objectOrderArray.indexOf(obj2)) ? -1 : 1;
            }
        };
        
        var criteriaTarget = function(a,b){
            return criteriaObject(a.obj, b.obj);
        };
        
        var criteriaEvent = function(a,b) {
            var typeA = typeof(a.event);
            var typeB = typeof(b.event);
            if (typeA == typeB) {
                var valueA = (typeA == 'function') ? a.event.toString() : a.event;
                var valueB = (typeB == 'function') ? b.event.toString() : b.event;
                if (valueA < valueB) {
                    return -1;
                } else if (valueA > valueB) {
                    return 1;
                } else {
                    return 0;
                }
            } else {
                return (typeA == 'function') ? 1 : -1;
            }
        };
        
        var criteriaViewer = function(a,b){
            return criteriaObject(a.context, b.context);
        };
        
        var criteriaMethod = function(a,b){
            var typeA = typeof(a.method);
            var typeB = typeof(b.method);
            if (typeA == typeB) {
                var valueA = (typeA == 'function') ? a.method.toString() : a.method;
                var valueB = (typeB == 'function') ? b.method.toString() : b.method;
                if (valueA < valueB) {
                    return -1;
                } else if (valueA > valueB) {
                    return 1;
                } else {
                    return 0;
                }
            } else {
                return (typeA == 'function') ? 1 : -1;
            }
        };
        
        this.criterias = [criteriaTarget, criteriaEvent, criteriaViewer, criteriaMethod];
        
        this.getPriorityCriteriaOrder = function(){
            var criteriaOrder = [];
            var i;
            for (i=0; i<this.priorityCriteriaArray.length; i++) {
                criteriaOrder[i] = this.criterias[this.priorityCriteriaArray[i]];
            }
            return criteriaOrder;
        };
        
        this.getSortFunctionForCriteriaArray = function(criterias){
            return function(a,b){
                var ret = 0;
                var i;
                for(i=0; i<criterias.length && ret==0; i++){
                    ret = criterias[i].call(null,a,b);
                }
                return ret;
            };
        };
        
        this.sortConnectionArray = function (connectionArray) {
            connectionArray.sort(this.getSortFunctionForCriteriaArray(this.getPriorityCriteriaOrder()));
            return connectionArray;
        };
    };
    
    
    DojoModel.ConnectionArraySorter.OBJ = 0;
    DojoModel.ConnectionArraySorter.EVENT = 1;
    DojoModel.ConnectionArraySorter.CONTEXT = 2;
    DojoModel.ConnectionArraySorter.METHOD = 3;

    // ***************************************************************

    // ***************************************************************
    // exported classes
    // ***************************************************************    

    DojoModel.EventsRegistrator = EventsRegistrator;
    
    DojoModel.ConnectionsAPI = ConnectionsAPI;
    
    DojoModel.FunctionLinkResolver = FunctionLinkResolver;
    DojoModel.Connection = Connection;
    DojoModel.Subscription = Subscription;
    DojoModel.OnAspectObserver = OnAspectObserver;
    DojoModel.ConnectionArraySorter = ConnectionArraySorter;

    return DojoModel;
});