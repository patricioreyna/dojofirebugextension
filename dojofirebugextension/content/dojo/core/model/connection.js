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
       ], function connectionModelFactory(Obj, FBTrace, DojoModel, DojoProxies, Collections, DojoFilter)
{
          
     // EXPORTED EVENTS
    var ON_CONNECTION_ADDED = DojoModel.Tracker.ON_CONNECTION_ADDED = 'connection_added';
    var ON_CONNECTION_REMOVED = DojoModel.Tracker.ON_CONNECTION_REMOVED = 'connection_removed';
     
     
     // ***************************************************************
          
     /**
      * @class Connection
      */
     var Connection = function(obj, /*string|function*/event, context, method, originalFunction, dontFix, callerInfo) {
         this.clazz = "Connection";
         this.obj = obj;
         this.event = event;
         this.context = context;
         this.method = method;
         this.originalFunction = originalFunction;
         this.dontFix = dontFix;
         this.callerInfo = callerInfo;                
     };
     Connection.prototype = Obj.extend(DojoModel.AbstractObserver.prototype, {
         
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

         register: function(/*Tracker*/tracker, handle) {             
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
             tracker.fireEvent(ON_CONNECTION_ADDED);
         },

         unregister: function(/*Tracker*/tracker, handle) {
             
             if(FBTrace.DBG_DOJO_DBG) {                        
                 FBTrace.sysout("DOJO DEBUG: removing connection", [handle, this]);
             }             
             
             //Remove connection from global list.
             //TODO performance
             tracker.sharedSpace._allConnectionsArray.splice(tracker.sharedSpace._allConnectionsArray.indexOf(this), 1);
             
             // Remove incoming connection
             this._unregisterIncomingConnection(tracker.getTrackingInfoFor(this.obj));
             tracker.trackingInfoDeleted(this.obj);
             
             // Remove outgoing connection
             this._unregisterOutgoingConnection(tracker.getTrackingInfoFor(this.context));
             tracker.trackingInfoDeleted(this.context);
             
             // Raised the onConnectionRemoved event if there is registered handler.
             tracker.fireEvent(ON_CONNECTION_REMOVED);
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
             arr.splice(arr.indexOf(this),1); //TODO PERFORMANCE
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
             arr.splice(arr.indexOf(this),1); //TODO PERFORMANCE
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
             if(!theArray) {
                 return [];
             }
                          
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
      * @class ConnectionArraySorter
      */
    //TODO: Add comment!
    var ConnectionArraySorter = function (objectOrderArray, priorityCriteriaArray) {

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
      
    ConnectionArraySorter.OBJ = 0;
    ConnectionArraySorter.EVENT = 1;
    ConnectionArraySorter.CONTEXT = 2;
    ConnectionArraySorter.METHOD = 3;

    // ***************************************************************

    // ***************************************************************
    // exported classes
    // ***************************************************************    

    DojoModel.Connection = Connection;
    DojoModel.ConnectionArraySorter = ConnectionArraySorter;

    // ***************************************************************
    
    return DojoModel;
});