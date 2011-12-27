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
       ], function subscriptionModelFactory(Obj, FBTrace, DojoModel, DojoProxies, Collections, DojoFilter)
{

    // EXPORTED EVENTS
     var ON_SUBSCRIPTION_ADDED = DojoModel.Tracker.ON_SUBSCRIPTION_ADDED = 'subscription_added';
     var ON_SUBSCRIPTION_REMOVED = DojoModel.Tracker.ON_SUBSCRIPTION_REMOVED = 'subscription_removed';
     
     
     // ***************************************************************
     
     /**
      * @class Subscription
      */
     var Subscription = function(topic, context, method, callerInfo){
        this.clazz = "Subscription";
        this.topic = topic;
        this.context = context;
        this.method = method;
        this.callerInfo = callerInfo;
     };
     Subscription.prototype = Obj.extend(DojoModel.AbstractObserver.prototype, {
                 
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
             if(FBTrace.DBG_DOJO_DBG) {
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
             tracker.fireEvent(ON_SUBSCRIPTION_ADDED);
         },
         
         unregister: function(/*Tracker*/tracker, handle) {
             if(FBTrace.DBG_DOJO_DBG) {                        
                 FBTrace.sysout("DOJO DEBUG: removing subscription", [handle, this]);
             } 
             
             this._removeSubFromGlobalList(tracker);

             var subsContext = this._getIndexableContext(); //$HACK
             var trackingInfo = tracker.getTrackingInfoFor(subsContext);
             
             this._removeSubscriptionFromTrackingInfo(trackingInfo);           
             tracker.trackingInfoDeleted(subsContext);
                           
             // Raised the onSubscriptionRemoved event if there is registered handler.
             tracker.fireEvent(ON_SUBSCRIPTION_REMOVED);             
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

    // ***************************************************************
    // exported classes
    // ***************************************************************    

    DojoModel.Subscription = Subscription;

    // ***************************************************************
    
    return DojoModel;
});