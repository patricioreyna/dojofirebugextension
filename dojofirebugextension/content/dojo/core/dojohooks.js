/* Released under BSD license (see license.txt) */


/**
 * dojo hooks. Hooks into dojo (e.g connect and subscribe operations) and
 * creates proxies to gather information from app usage.
 * 
 * @author preyna@ar.ibm.com
 */
define([
        "firebug/lib/lib",
        "firebug/lib/object",
        "firebug/lib/trace",
        "firebug/lib/wrapper",
        "dojo/core/dojoaccess",
        "dojo/core/prefs",
        "dojo/core/proxies"
       ], function dojoHooksFactory(FBL, Obj, FBTrace, Wrapper, DojoAccess, DojoPrefs, DojoProxies)
{
    var DojoHooks = {};
    
    /***************************************************************************
     * ****************************************************************************
     * ****************************************************************************
     */       
    // CONTEXT RELATED METHODS (get an implementation)
    DojoHooks.initContext = function(context) {
        // no-op
    };
    DojoHooks.isInitialized = function(context) {
        return context.dojo.dojoHooks != undefined && context.dojo.dojoHooks != null;
    }; 
    DojoHooks.destroyInContext = function(context) {
        if(!context.dojo || !context.dojo.dojoHooks) {
            return;
        }        
        context.dojo.dojoHooks.destroy();
        delete context.dojo.dojoHooks;       
    };
    
    DojoHooks.getImpl = function(context, dojoVersion) {
        if(context.dojo.dojoHooks) {
            return context.dojo.dojoHooks;
        }

        if(FBTrace.DBG_DOJO) {
            FBTrace.sysout("DOJO dojo.version: "+ dojoVersion, dojoVersion);
        }

        var impl;
        var version = DojoAccess.Version.prototype.fromDojoVersion(dojoVersion);
        var pivot = DojoAccess.Version.prototype.fromVersionString("1.7.0b5");
        if(version.compare(pivot, /*strict comparison*/true) >= 0) {
            impl = new DojoHooks.DojoProxiesInitializer17();
        } else {
            impl = new DojoHooks.DojoProxiesInitializer();
        }
        
        context.dojo.dojoHooks = impl;
        return impl;
    };
    
    /***************************************************************************
     * ****************************************************************************
     * ****************************************************************************
     */    
    
    DojoHooks.DojoProxiesInitializer = function() {
        if(FBTrace.DBG_DOJO) {
            FBTrace.sysout("DOJO Default DojoProxiesInitializer impl created");
        }
    };
    DojoHooks.DojoProxiesInitializer.prototype = 
    {

            destroy: function() {
                // nothign to do
            },
    
            onCompilationUnit: function (context, url, kind, dojo, proxyFactory, dojoAccess, dojoDebugger, dojoTracker) {
                if (!context.connectHooked && dojo && dojo.connect) {
                    context.connectHooked = true;

                    this.injectProxies(context, dojo, proxyFactory, dojoAccess, dojoDebugger, dojoTracker);
                }

	           // Check if the _connect function was overwritten by event.js
                // new connect definition . (no need in dojo 1.7)
	           if (context.connectHooked && (!context.connectREHOOKED) && !DojoProxies.isDojoExtProxy(dojo._connect) && !dojo._connect._listeners) {
	               context.connectREHOOKED = true;
	               
	               proxyFactory.proxyFunction(context, dojo, "dojo", 5, "_connect", null, this._proxyConnect(context, dojo, dojoAccess, dojoDebugger, dojoTracker));
	                
	               // FIXME Replace this hack fix for a communication mechanism based on events.
	               DojoProxies.protectProxy(context, dojo, "_connect");
	           }   

            },
            
            injectProxies: function(context, dojo, proxyFactory, dojoAccess, dojoDebugger, dojoTracker) {

		        proxyFactory.proxyFunction(context, dojo, "dojo", 5, "_connect", null, this._proxyConnect(context, dojo, dojoAccess, dojoDebugger, dojoTracker));
		        proxyFactory.proxyFunction(context, dojo, "dojo", 1, "disconnect", this._proxyDisconnect(context, dojo, dojoAccess, dojoDebugger, dojoTracker), null);
		        proxyFactory.proxyFunction(context, dojo, "dojo", 3, "subscribe", null, this._proxySubscribe(context, dojo, dojoAccess, dojoDebugger, dojoTracker));
		        proxyFactory.proxyFunction(context, dojo, "dojo", 1, "unsubscribe", this._proxyUnsubscribe(context, dojo, dojoAccess, dojoDebugger, dojoTracker), null);
                
                // FIXME[BugTicket#91]: Replace this hack fix for a communication mechanism based on events.
                DojoProxies.protectProxy(context, '_connect', 'disconnect', 'subscribe', 'unsubscribe');
            },

            /**
             * returns a boolean to define if the connection should or should
             * not be registered considering the objects in it.
             */
            _filterConnection: function(obj, event, context, method, dojoAccessor) {
                return dojoAccessor.isDojoAnimation(obj) && dojoAccessor.isDojoAnimation(context);
            },
            
            _proxyConnect : function(context, dojo, dojoAccess, dojoDebugger, dojoTracker) {

		        if(FBTrace.DBG_DOJO_DBG) {
		            FBTrace.sysout("DOJO creating proxyConnect", {'dojoAccess':dojoAccess, 'dojoTracker': dojoTracker, 'dojoDebugger':dojoDebugger});
		            
		        }

		        var self = this;
		        return function(ret, args) {

                   // FIXME[BugTicket#91]: Defensive code to avoid registering
                    // a connection made as part of a hack solution.
                   if (args[3] && args[3].internalClass == 'dojoext-added-code') {
                       return ret; 
                   }
            
                   var obj =  Wrapper.unwrapObject(args[0] || dojo.global);            
                   var event = Wrapper.unwrapObject(args[1]);                   

                   /*
                     * The context parameter could be null, in that case it will
                     * be determined according to the dojo.hitch implementation.
                     * See the dojo.hitch comment at [dojo
                     * directory]/dojo/_base/lang.js and dojo.connect comment at
                     * [dojo directory]/dojo/_base/connect.js
                     */
                   var handlerContext = args[2];
                   if (!handlerContext) {
                      if (typeof(args[3]) == 'function') {
                           handlerContext = obj;
                      } else {
                           handlerContext = dojo.global;
                      }                   
                   }
                   handlerContext = Wrapper.unwrapObject(handlerContext);
                  
                   var method = Wrapper.unwrapObject(args[3]);
                   var dontFix = Wrapper.unwrapObject((args.length >= 5 && args[4]) ? args[4] : null);

                   var callerInfo = (context.initialConfig.breakPointPlaceSupportEnabled) ? dojoDebugger.getDebugInfoAboutConnectCaller(context) : null;
                           
                   // Verify if the connection should be filtered.
                   if (DojoPrefs._isDojoAnimationsFilterEnabled() && 
                        self._filterConnection(obj, event, handlerContext, method, dojoAccess)) { 
                       return ret; 
                   }
                   
                   dojoTracker.addConnection(obj, event, handlerContext, method, dontFix, ret, callerInfo);
                   return ret;
                };
            },

		   _proxyDisconnect : function(context, dojo, dojoAccess, dojoDebugger, dojoTracker){
		        if(FBTrace.DBG_DOJO_DBG) {
		            FBTrace.sysout("DOJO creating proxyDisconnect");
		        }

		        return function(handle) {
		            if(FBTrace.DBG_DOJO_DBG) {
	                    FBTrace.sysout("DOJO DEBUG executing proxyDisconnect with arguments: ", arguments);
	                }

		            dojoTracker.removeConnection(Wrapper.unwrapObject(handle));
		        };
		   },

		   _proxySubscribe : function(context, dojo, dojoAccess, dojoDebugger, dojoTracker){

		        if(FBTrace.DBG_DOJO_DBG) {
		            FBTrace.sysout("DOJO creating proxySubscribe");
		        }

		       return function(ret, args) {
                   var callerInfo = (context.initialConfig.breakPointPlaceSupportEnabled) ? dojoDebugger.getDebugInfoAboutSubscribeCaller(context) : null;
                   var scope = Wrapper.unwrapObject(args[1]);
                   var method = Wrapper.unwrapObject(args[2]);                    
                   
                   // mimic dojo.hitch logic regarding missing (omitted)
                    // context argument
                   if(!method){
                       method = scope;
                       scope = null;
                   }
                   
                   if (!scope) {
                       scope = (typeof(method) == 'string') ? dojo.global : dojo;
                   }
                   
                   var topic = Wrapper.unwrapObject(args[0]);
                   dojoTracker.addSubscription(topic, scope, method, ret, callerInfo);
                   return ret;
              };
		   },
		  
		   _proxyUnsubscribe : function(context, dojo, dojoAccess, dojoDebugger, dojoTracker){
		        if(FBTrace.DBG_DOJO_DBG) {
		            FBTrace.sysout("DOJO creating proxyUnsubscribe");
		        }

			   return function(handle) {
			       if(FBTrace.DBG_DOJO_DBG) {
			           FBTrace.sysout("DOJO DEBUG executing proxyUnsubscribe with arguments: ", arguments);
			       }

			       dojoTracker.removeSubscription(Wrapper.unwrapObject(handle));
		       };
		   }
    };

    
    /***************************************************************************
     * ****************************************************************************
     * ****************************************************************************
     */    
    
    DojoHooks.DojoProxiesInitializer17 = function() {
        if(FBTrace.DBG_DOJO) {
            FBTrace.sysout("DOJO DojoProxiesInitializer for dojo 1.7 created");
        }
    };
    DojoHooks.DojoProxiesInitializer17.prototype = Obj.extend(DojoHooks.DojoProxiesInitializer.prototype, {

		onCompilationUnit: function (context, url, kind, dojo, proxyFactory, dojoAccess, dojoDebugger, dojoTracker) {
			if (!context.connectHooked && dojo && dojo.connect) {

				context.connectHooked = true;
				
				this.injectProxies(context, dojo, proxyFactory, dojoAccess, dojoDebugger, dojoTracker);
			}			

			//let's wrap _WidgetBase functions (connect, subscribe..) as well ..
			this.injectProxiesWidgetBase(context, dojo, proxyFactory, dojoAccess, dojoDebugger, dojoTracker);
		},

		injectProxies: function(context, dojo, proxyFactory, dojoAccess, dojoDebugger, dojoTracker) {

            if(FBTrace.DBG_DOJO) {
                FBTrace.sysout("injecting wrappers....");
            }

			var require = Wrapper.unwrapObject(context.window).require;
            var connectModule = require.modules['dojo/_base/connect'].result;

            // hook on connect AMD module's connect and others
            proxyFactory.proxyFunction(context, connectModule, "connect.js", 5, /* "_connect" */"connect", null, this._proxyConnect(context, dojo, dojoAccess, dojoDebugger, dojoTracker, /*depth connect place*/2));
            proxyFactory.proxyFunction(context, connectModule, "connect.js", 3, "subscribe", null, this._proxySubscribe(context, dojo, dojoAccess, dojoDebugger, dojoTracker, /*depth subscribe place*/2));
            proxyFactory.proxyFunction(context, connectModule, "connect.js", 1, "disconnect", this._proxyDisconnect(context, dojo, dojoAccess, dojoDebugger, dojoTracker), null);
            proxyFactory.proxyFunction(context, connectModule, "connect.js", 1, "unsubscribe", this._proxyUnsubscribe(context, dojo, dojoAccess, dojoDebugger, dojoTracker), null);
            // FIXME Replace this hack fix for a communication mechanism based on events.
            DojoProxies.protectProxy(context, connectModule, /* "_connect" */"connect", 'disconnect', 'subscribe', 'unsubscribe');

            // hook on dojo's connect
            proxyFactory.proxyFunction(context, dojo, "dojo", 5, /* "_connect" */"connect", null, this._proxyConnect(context, dojo, dojoAccess, dojoDebugger, dojoTracker, /*depth connect place*/0));
            proxyFactory.proxyFunction(context, dojo, "dojo", 1, "disconnect", this._proxyDisconnect(context, dojo, dojoAccess, dojoDebugger, dojoTracker), null);
            proxyFactory.proxyFunction(context, dojo, "dojo", 3, "subscribe", null, this._proxySubscribe(context, dojo, dojoAccess, dojoDebugger, dojoTracker, /*depth subscribe place*/0));
            proxyFactory.proxyFunction(context, dojo, "dojo", 1, "unsubscribe", this._proxyUnsubscribe(context, dojo, dojoAccess, dojoDebugger, dojoTracker), null);            
            // FIXME Replace this hack fix for a communication mechanism based on events.
            DojoProxies.protectProxy(context, /* "_connect" */"connect", 'disconnect', 'subscribe', 'unsubscribe');

		},
		
		injectProxiesWidgetBase: function(context, dojo, proxyFactory, dojoAccess, dojoDebugger, dojoTracker) {
		    var require = Wrapper.unwrapObject(context.window).require;
            var widgetBaseModule = require.modules['dijit/_WidgetBase'];
            
            if(!context.widgetBaseModuleWrapped && widgetBaseModule && widgetBaseModule.executed == 'executed') {
                context.widgetBaseModuleWrapped = true;
                
                if(FBTrace.DBG_DOJO) {
                    FBTrace.sysout("about to wrap dijit._WidgetBase. widgetBaseModule is: ", widgetBaseModule);
                }

                try {
                    //Connect place Note: for dijits using _OnDijitClickMixin (i.e. all of them) we need to return 4 level depth frame 
                    //as the caller function (TODO: for mobile widgets should be 3)
                    proxyFactory.proxyFunction(context, widgetBaseModule.result.prototype, "_WidgetBase.js", 3, /* "_connect" */"connect", this._connectPreviousAdviceWidgetBase(context, dojo, dojoAccess, dojoDebugger, dojoTracker), this._proxyConnectWidgetBase(context, dojo, dojoAccess, dojoDebugger, dojoTracker, /*depth connect place*/4));
                    proxyFactory.proxyFunction(context, widgetBaseModule.result.prototype, "_WidgetBase.js", 2, "subscribe", null, this._proxySubscribeWidgetBase(context, dojo, dojoAccess, dojoDebugger, dojoTracker, /*depth subscribe place*/2));
                    proxyFactory.proxyFunction(context, widgetBaseModule.result.prototype, "_WidgetBase.js", 1, "unsubscribe", this._proxyUnsubscribeWidgetBase(context, dojo, dojoAccess, dojoDebugger, dojoTracker), null);                   
                    proxyFactory.proxyFunction(context, widgetBaseModule.result.prototype, "_WidgetBase.js", 1, "disconnect", this._proxyDisconnectWidgetBase(context, dojo, dojoAccess, dojoDebugger, dojoTracker), null);
                    // FIXME Replace this hack fix for a communication mechanism based on events.
                    DojoProxies.protectProxy(context, widgetBaseModule.result.prototype, 'subscribe', 'unsubscribe', 'connect', 'disconnect');

                    if(FBTrace.DBG_DOJO) {
                        FBTrace.sysout("_WidgetBase wrapped successfully");
                    }

                } catch(e) {
                    FBTrace.sysout("error while trying to inject wrappers to _WidgetBase.js: ", e);
                }
            }		    
		},
		
	    /**
         * extracted from connect.js (dojo 1.7.0b5)
         */
	    /* array */_normalizeConnectArguments: function() {
			// normalize arguments
			var a=arguments, args=[], i=0;
			// if a[0] is a String, obj was omitted
			args.push(typeof a[0] == "string" ? null : a[i++], a[i++]);
			// if the arg-after-next is a String or Function, context was NOT
            // omitted
			var a1 = a[i+1];
			args.push(typeof a1 == "string" || typeof a1 == "function" ? a[i++] : null, a[i++]);
			// absorb any additional arguments
			var l = null;
			for(l = a.length; i<l; i++){	args.push(a[i]); }
			return args;
	    },
	    
	    _proxyConnect : function(context, dojo, dojoAccess, dojoDebugger, dojoTracker, stackDepthForConnectPlace){

	        if(FBTrace.DBG_DOJO_DBG) {
	            FBTrace.sysout("DOJO creating _proxyConnect 17");
	        }
	        
	        var self = this;	        
	        return function(ret, args) {
	            
	            if(context.dojoextComingFromOtherProxy) {
	                if(FBTrace.DBG_DOJO_DBG) {
	                    FBTrace.sysout("DOJO coming from OtherProxy. Ignoring...");
	                }
	                return ret;
	            }

	            if(FBTrace.DBG_DOJO_DBG) {                        
	                FBTrace.sysout("DOJO DEBUG: connect 1.7 invoked with this args and result: ", { 'args':args, 'ret':ret});
	            }

	            // we need to normalize arguments (copied from dojo connect)
	            args = self._normalizeConnectArguments.apply(this, args);
	            if(FBTrace.DBG_DOJO_DBG) {
	                FBTrace.sysout("DOJO DEBUG: normalized arguments: ", args);
	            }

               // FIXME[BugTicket#91]: Defensive code to avoid registering a connection made as part of a hack solution.
               if (args[3] && args[3].internalClass == 'dojoext-added-code') {
		            if(FBTrace.DBG_DOJO_DBG) {                        
		                FBTrace.sysout("DOJO DEBUG: returning from wrapper created wth proxyConnect since given method was proxy as well", { 'args':args, 'ret':ret});
		            }

                   return ret; 
               }
        
               var obj =  Wrapper.unwrapObject(args[0] || dojo.global);            
               var event = Wrapper.unwrapObject(args[1]); // can be a function (dojo 1.7)

               /*
                 * The context parameter could be null, in that case it
                 * will be determined according to the dojo.hitch
                 * implementation. See the dojo.hitch comment at [dojo
                 * directory]/dojo/_base/lang.js and dojo.connect
                 * comment at [dojo directory]/dojo/_base/connect.js
                 */
               var handlerContext = args[2];
               if (!handlerContext) {
                  if (typeof(args[3]) == 'function') {
                       handlerContext = obj;
                  } else {
                       handlerContext = dojo.global;
                  }                   
               }
               handlerContext = Wrapper.unwrapObject(handlerContext);
              
               var method = Wrapper.unwrapObject(args[3]);
               var dontFix = Wrapper.unwrapObject((args.length >= 5 && args[4]) ? args[4] : null);

               stackDepthForConnectPlace = stackDepthForConnectPlace || 0;
               var callerInfo = (context.initialConfig.breakPointPlaceSupportEnabled) ? dojoDebugger.getDebugInfoAboutCaller(context, stackDepthForConnectPlace) : null;
                       
               // Verify if the connection should be filtered.
               if (DojoPrefs._isDojoAnimationsFilterEnabled() && 
                    self._filterConnection(obj, event, handlerContext, method, dojoAccess)) { 
                   return ret; 
               }
               
               dojoTracker.addConnection(obj, event, handlerContext, method, dontFix, ret, callerInfo);
               return ret;
            };
	   },
	   
       _proxySubscribeWidgetBase : function(context, dojo, dojoAccess, dojoDebugger, dojoTracker, stackDepthForSubPlace) {

           if(FBTrace.DBG_DOJO_DBG) {
               FBTrace.sysout("DOJO creating proxySubscribeWidgetBase");
           }

          return function(ret, args) {

              if(FBTrace.DBG_DOJO_DBG) {
                  FBTrace.sysout("DOJO executing subscribeWidgetBase Ret: ", ret);
                  FBTrace.sysout("DOJO executing subscribeWidgetBase Args: ", args);
                  FBTrace.sysout("DOJO executing subscribeWidgetBase This: ", this);
              }

              stackDepthForSubPlace = stackDepthForSubPlace || 0;
              var callerInfo = (context.initialConfig.breakPointPlaceSupportEnabled) ? dojoDebugger.getDebugInfoAboutCaller(context, stackDepthForSubPlace) : null;
              var topic = Wrapper.unwrapObject(args[0]);
              var method = Wrapper.unwrapObject(args[1]);
              var scope = this; //the widget instance..                    
                                                       
              dojoTracker.addSubscription(topic, scope, method, ret, callerInfo);

              return ret;
         };
      },
            
      _proxyUnsubscribeWidgetBase : function(context, dojo, dojoAccess, dojoDebugger, dojoTracker){
          if(FBTrace.DBG_DOJO_DBG) {
              FBTrace.sysout("DOJO creating _proxyUnsubscribeWidgetBase");
          }

         return function(handle) {
             if(FBTrace.DBG_DOJO_DBG) {
                 FBTrace.sysout("DOJO DEBUG executing _proxyUnsubscribeWidgetBase with arguments: ", arguments);
             }
             
             dojoTracker.removeSubscription(Wrapper.unwrapObject(handle));
             
             //add flag to avoid disconnect to catch this as well.
             handle.dojoextComingFromUnsubscribe = true;
         };
      },

      _connectPreviousAdviceWidgetBase: function(context, dojo, dojoAccess, dojoDebugger, dojoTracker) {
          if(FBTrace.DBG_DOJO_DBG) {
              FBTrace.sysout("DOJO creating _connectPreviousAdviceWidgetBase");
          }

          return function(args) {
              if(FBTrace.DBG_DOJO_DBG) {
                  FBTrace.sysout("DOJO DEBUG executing _connectPreviousAdviceWidgetBase with arguments: ", args);
              }

              //add flag to avoid normal connect proxy to catch this as well.
              //TODO beware with this code. Is there a potential problem of different connects? (multi-process?)
              context.dojoextComingFromOtherProxy = true;              
          }
      },

      
      _proxyConnectWidgetBase: function(context, dojo, dojoAccess, dojoDebugger, dojoTracker, stackDepthForConnectPlace) {
          if(FBTrace.DBG_DOJO_DBG) {
              FBTrace.sysout("DOJO creating _proxyConnectWidgetBase");
          }

          var self = this;
          return function(ret, args) {
              //args are: obj/*Object|null*/ , event/*string|function*/, method/*string|function*/
              if(FBTrace.DBG_DOJO_DBG) {
                  FBTrace.sysout("DOJO DEBUG executing _proxyConnectWidgetBase with this args and result: ", { 'args':args, 'ret':ret});
              }
              delete context.dojoextComingFromOtherProxy;


             // FIXME[BugTicket#91]: Defensive code to avoid registering a connection made as part of a hack solution.
             if (args[2] && args[2].internalClass == 'dojoext-added-code') {
                  if(FBTrace.DBG_DOJO_DBG) {                        
                      FBTrace.sysout("DOJO DEBUG: returning from wrapper created wth proxyConnect since given method was proxy as well", { 'args':args, 'ret':ret});
                  }
                 return ret; 
             }
      
             var obj =  Wrapper.unwrapObject(args[0] || dojo.global);            
             var event = Wrapper.unwrapObject(args[1]); // can be a function (dojo 1.7)
             var handlerContext = this; //the widget instance
             var method = Wrapper.unwrapObject(args[2]);
             var dontFix = null;

             stackDepthForConnectPlace = stackDepthForConnectPlace || 0;
             var callerInfo = (context.initialConfig.breakPointPlaceSupportEnabled) ? dojoDebugger.getDebugInfoAboutCaller(context, stackDepthForConnectPlace) : null;
                     
             // Verify if the connection should be filtered.
             if (DojoPrefs._isDojoAnimationsFilterEnabled() && 
                  self._filterConnection(obj, event, handlerContext, method, dojoAccess)) { 
                 return ret; 
             }
             
             dojoTracker.addConnection(obj, event, handlerContext, method, dontFix, ret, callerInfo);
             return ret;
          }
      
      },

      _proxyDisconnectWidgetBase : function(context, dojo, dojoAccess, dojoDebugger, dojoTracker){
          if(FBTrace.DBG_DOJO_DBG) {
              FBTrace.sysout("DOJO creating _proxyDisconnectWidgetBase");
          }

          return function(handle) {
              if(handle.dojoextComingFromUnsubscribe) {
                  if(FBTrace.DBG_DOJO_DBG) {
                      FBTrace.sysout("DOJO coming from _proxyUnsubscribeWidgetBase. Ignoring...");
                  }
                  return;
              }
              if(FBTrace.DBG_DOJO_DBG) {
                  FBTrace.sysout("DOJO DEBUG executing _proxyDisconnectWidgetBase with arguments: ", arguments);
              }

              dojoTracker.removeConnection(Wrapper.unwrapObject(handle));
          };
      }



    });


    return DojoHooks;
});