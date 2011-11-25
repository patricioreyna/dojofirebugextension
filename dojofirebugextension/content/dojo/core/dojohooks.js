/* Released under BSD license (see license.txt) */


/**
 * dojo hooks. Hooks into dojo (e.g connect and subscribe operations) and
 * creates proxies to gather information from app usage.
 * There is a hierarchy to cope with the different dojo versions.
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
        "dojo/core/proxies",
        "dojo/core/trace-error-log"
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

        try {
        
        var impl;
        var version = DojoAccess.Version.prototype.fromDojoVersion(dojoVersion);
       
        var pivotDojo17 = DojoAccess.Version.prototype.fromVersionString("1.7.0");
        var pivotDojo17Beta5 = DojoAccess.Version.prototype.fromVersionString("1.7.0b5");
        var pivot17PreDojoBeta5 = DojoAccess.Version.prototype.fromVersionString("1.7.0b1");
        
        if(version.compare(pivotDojo17, /*strict comparison*/true) >= 0) {
            impl = new DojoHooks.DojoProxiesInitializer17();
        } else if(version.compare(pivotDojo17Beta5, /*strict comparison*/true) >= 0) {
            impl = new DojoHooks.DojoProxiesInitializer17Base();
        } else if(version.compare(pivot17PreDojoBeta5, /*strict comparison*/true) >= 0) {
            impl = new DojoHooks.DojoProxiesInitializer17PreBeta5();
        } else {
            //older dojo versions (<= 1.6.x)
            impl = new DojoHooks.DojoProxiesInitializer();
        }

        } catch(e) {
            if(FBTrace.DBG_DOJO) {
                FBTrace.sysout(e);
                //FBTrace.sysout("ERROR - message: ["+ e.message + "] fileName: " + e.fileName + " lineNumber: " + e.lineNumber);
            }    
        }
        
        context.dojo.dojoHooks = impl;
        return impl;
    };
    
    /***************************************************************************
     * ****************************************************************************
     * ****************************************************************************
     */    
   //connect/subscribe methods are defined in dojo/_base/connect, dojo/_base/event and dijit/_Widget (v1.5)
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

                this.injectProxies(context, dojo, proxyFactory, dojoAccess, dojoDebugger, dojoTracker);

                // Check if the _connect function was overwritten by event.js
                // new connect definition . (no need in dojo 1.7)
                if (context.connectHooked && (!context.connectREHOOKED) && !DojoProxies.isDojoExtProxy(dojo._connect) && !dojo._connect._listeners) {
                    context.connectREHOOKED = true;
                   
                    proxyFactory.proxyFunction(context, dojo, "_connect", null, this._proxyConnect(context, dojo, dojoAccess, dojoDebugger, dojoTracker, 2));
                    
                    // FIXME Replace this hack fix for a communication mechanism based on events.
                    DojoProxies.protectProxy(context, dojo, "_connect");
                    
                    //trace
                    this._fbTraceConnectionsNotTracked(context);
                                    
                }   
            },
            
            _fbTraceConnectionsNotTracked: function(context) {
                if(FBTrace.DBG_DOJO_CONN_COUNTER) {
                    var conn_counter = Wrapper.unwrapObject(context.window).connections || 0;
                    var subs_counter = Wrapper.unwrapObject(context.window).subscriptions || 0;
                    FBTrace.sysout("connections original value (prev to tracking): " + conn_counter);
                    FBTrace.sysout("subscriptions original value (prev to tracking): " + subs_counter);
                }
            },
            
            injectProxies: function(context, dojo, proxyFactory, dojoAccess, dojoDebugger, dojoTracker) {

                if (!context.connectHooked && dojo && dojo.connect) {
                    context.connectHooked = true;

                    this.injectProxiesDojoGlobal(context, dojo, proxyFactory, dojoAccess, dojoDebugger, dojoTracker);
                    
                    //trace
                    this._fbTraceConnectionsNotTracked(context);
                }                
            },

            injectProxiesDojoGlobal: function(context, dojo, proxyFactory, dojoAccess, dojoDebugger, dojoTracker) {
                
                if(FBTrace.DBG_DOJO) {
                    FBTrace.sysout("injecting wrappers to dojo global (older version , with _connect)");
                }

                proxyFactory.proxyFunction(context, dojo, "_connect", null, this._proxyConnect(context, dojo, dojoAccess, dojoDebugger, dojoTracker, 2));
                proxyFactory.proxyFunction(context, dojo, "disconnect", this._proxyDisconnect(context, dojo, dojoAccess, dojoDebugger, dojoTracker), null);
                proxyFactory.proxyFunction(context, dojo, "subscribe", null, this._proxySubscribe(context, dojo, dojoAccess, dojoDebugger, dojoTracker, 1));
                proxyFactory.proxyFunction(context, dojo, "unsubscribe", this._proxyUnsubscribe(context, dojo, dojoAccess, dojoDebugger, dojoTracker), null);
                
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
                for(l = a.length; i<l; i++){    args.push(a[i]); }
                return args;               
            },

            _proxyConnect: function(context, dojo, dojoAccess, dojoDebugger, dojoTracker, stackDepthForConnectPlace) {

                if(FBTrace.DBG_DOJO) {
                    FBTrace.sysout("DOJO creating proxyConnect", {'dojoAccess':dojoAccess, 'dojoTracker': dojoTracker, 'dojoDebugger':dojoDebugger});
                    
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
                        FBTrace.sysout("DOJO DEBUG: connect invoked with this args and result: ", { 'args':args, 'ret':ret});
                    }

                    if(FBTrace.DBG_DOJO_DBG) {
                        var originalArgs = args;
                    }
                    
                    // we need to normalize arguments (copied from dojo connect)
                    args = self._normalizeConnectArguments.apply(this, args);                   
                    if(FBTrace.DBG_DOJO_DBG) {
                        FBTrace.sysout("DOJO DEBUG: normalized arguments: ", args);
                    }
                                       
                    if(FBTrace.DBG_DOJO_DBG) {
                        var repeat = self._normalizeConnectArguments.apply(this, args);
                        
                        FBTrace.sysout("DOJO TEST NORMALIZE : original: ", Array.prototype.slice.call(originalArgs));
                        FBTrace.sysout("DOJO TEST NORMALIZE : normalized: ", Array.prototype.slice.call(args));
                        FBTrace.sysout("DOJO TEST NORMALIZE : twice-normalized: ", Array.prototype.slice.call(repeat));
                    }
                    
                    
                   // FIXME[BugTicket#91]: Defensive code to avoid registering
                    // a connection made as part of a hack solution.
                   if (args[3] && args[3].internalClass == 'dojoext-added-code') {
                       return ret; 
                   }
            
                   var obj =  Wrapper.unwrapObject(args[0] || dojo.global);            
                   var event = Wrapper.unwrapObject(args[1]); //can be a function in dojo 1.7                   

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

           _proxyDisconnect : function(context, dojo, dojoAccess, dojoDebugger, dojoTracker){
                if(FBTrace.DBG_DOJO) {
                    FBTrace.sysout("DOJO creating proxyDisconnect");
                }

                return function(handle) {
                    if(FBTrace.DBG_DOJO_DBG) {
                        FBTrace.sysout("DOJO DEBUG executing proxyDisconnect with arguments: ", arguments);
                    }

                    dojoTracker.removeConnection(Wrapper.unwrapObject(handle));
                };
           },

           _proxySubscribe : function(context, dojo, dojoAccess, dojoDebugger, dojoTracker, stackDepthForSubPlace){

                if(FBTrace.DBG_DOJO) {
                    FBTrace.sysout("DOJO creating proxySubscribe");
                }

               return function(ret, args) {
                   
                   if(context.dojoextComingFromOtherProxy) {
                        if(FBTrace.DBG_DOJO_DBG) {
                            FBTrace.sysout("DOJO coming from OtherProxy. Ignoring...");
                        }
                        return ret;
                    }
                   
                   stackDepthForSubPlace = stackDepthForSubPlace || 0;
                   var callerInfo = (context.initialConfig.breakPointPlaceSupportEnabled) ? dojoDebugger.getDebugInfoAboutCaller(context, stackDepthForSubPlace) : null;
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
                if(FBTrace.DBG_DOJO) {
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
    //connect/subscribe methods are defined in dojo/_base/connect and dijit/_WidgetBase
    DojoHooks.DojoProxiesInitializer17Base = function() {
        if(FBTrace.DBG_DOJO) {
            FBTrace.sysout("DOJO DojoProxiesInitializer17Base created");
        }
    };
    DojoHooks.DojoProxiesInitializer17Base.prototype = Obj.extend(DojoHooks.DojoProxiesInitializer.prototype, {

        onCompilationUnit: function (context, url, kind, dojo, proxyFactory, dojoAccess, dojoDebugger, dojoTracker) {
            
            this.injectProxies(context, dojo, proxyFactory, dojoAccess, dojoDebugger, dojoTracker);
        },

        injectProxies: function(context, dojo, proxyFactory, dojoAccess, dojoDebugger, dojoTracker) {

            if (!context.connectHooked && dojo && dojo.connect) {

                context.connectHooked = true;
                
                if(FBTrace.DBG_DOJO) {
                    FBTrace.sysout("injecting wrappers....");
                }

                this.injectProxiesConnectModule(context, dojo, proxyFactory, dojoAccess, dojoDebugger, dojoTracker);
                this.injectProxiesDojoGlobal(context, dojo, proxyFactory, dojoAccess, dojoDebugger, dojoTracker);

                //trace
                this._fbTraceConnectionsNotTracked(context);
                
            }           

            //let's wrap _WidgetBase functions (connect, subscribe..) as well ..
            this.injectProxiesWidgetBase(context, dojo, proxyFactory, dojoAccess, dojoDebugger, dojoTracker);

        },
        
        injectProxiesDojoGlobal: function(context, dojo, proxyFactory, dojoAccess, dojoDebugger, dojoTracker) {

            if(FBTrace.DBG_DOJO) {
                FBTrace.sysout("injecting wrappers to dojo global....");
            }

            // hook on dojo's connect
            proxyFactory.proxyFunction(context, dojo, "connect", null, this._proxyConnect(context, dojo, dojoAccess, dojoDebugger, dojoTracker, /*depth connect place*/0));
            proxyFactory.proxyFunction(context, dojo, "disconnect", this._proxyDisconnect(context, dojo, dojoAccess, dojoDebugger, dojoTracker), null);
            proxyFactory.proxyFunction(context, dojo, "subscribe", null, this._proxySubscribe(context, dojo, dojoAccess, dojoDebugger, dojoTracker, /*depth subscribe place*/0));
            proxyFactory.proxyFunction(context, dojo, "unsubscribe", this._proxyUnsubscribe(context, dojo, dojoAccess, dojoDebugger, dojoTracker), null);            
            // FIXME Replace this hack fix for a communication mechanism based on events.
            DojoProxies.protectProxy(context, "connect", 'disconnect', 'subscribe', 'unsubscribe');

        },


        injectProxiesConnectModule: function(context, dojo, proxyFactory, dojoAccess, dojoDebugger, dojoTracker) {

            if(FBTrace.DBG_DOJO) {
                FBTrace.sysout("injecting wrappers to connect module....");
            }

            var connectModule = this._getModule(context, 'dojo/_base/connect');

            // hook on connect AMD module's connect and others
            proxyFactory.proxyFunction(context, connectModule, "connect", null, this._proxyConnect(context, dojo, dojoAccess, dojoDebugger, dojoTracker, /*depth connect place*/2));
            proxyFactory.proxyFunction(context, connectModule, "subscribe", null, this._proxySubscribe(context, dojo, dojoAccess, dojoDebugger, dojoTracker, /*depth subscribe place*/2));
            proxyFactory.proxyFunction(context, connectModule, "disconnect", this._proxyDisconnect(context, dojo, dojoAccess, dojoDebugger, dojoTracker), null);
            proxyFactory.proxyFunction(context, connectModule, "unsubscribe", this._proxyUnsubscribe(context, dojo, dojoAccess, dojoDebugger, dojoTracker), null);
            // FIXME Replace this hack fix for a communication mechanism based on events.
            DojoProxies.protectProxy(context, connectModule, "connect", 'disconnect', 'subscribe', 'unsubscribe');

        },
                
        _getModule: function(context, moduleName) {
            var require = Wrapper.unwrapObject(context.window).require;
            var module = require.modules[moduleName];
            
            if(module && module.executed && (module.executed == 'executed' || module.executed.value == 'executed')) {
                return module.result;
            } else {
                return undefined;
            }            
        },     
        
        _getWidgetBaseModule: function(context) {
            return this._getModule(context, 'dijit/_WidgetBase');
        },
        
        injectProxiesWidgetBase: function(context, dojo, proxyFactory, dojoAccess, dojoDebugger, dojoTracker) {
                        
            var widgetBaseModule = this._getWidgetBaseModule(context);
            
            if(!context.widgetBaseModuleWrapped && widgetBaseModule) {
                context.widgetBaseModuleWrapped = true;
                
                if(FBTrace.DBG_DOJO) {
                    FBTrace.sysout("about to wrap dijit._WidgetBase. widgetBaseModule is: ", widgetBaseModule);
                }

                try {
                    //Connect place Note: for dijits using _OnDijitClickMixin (i.e. all of them) we need to return 4 level depth frame 
                    //as the caller function (TODO: for mobile widgets should be 3)
                    var mod = widgetBaseModule.prototype;
                    proxyFactory.proxyFunction(context, mod, "connect", this._connectPreviousAdviceWidgetBase(context, dojo, dojoAccess, dojoDebugger, dojoTracker), this._proxyConnectWidgetBase(context, dojo, dojoAccess, dojoDebugger, dojoTracker, /*depth connect place*/4));
                    proxyFactory.proxyFunction(context, mod, "subscribe", this._connectPreviousAdviceWidgetBase(context, dojo, dojoAccess, dojoDebugger, dojoTracker), this._proxySubscribeWidgetBase(context, dojo, dojoAccess, dojoDebugger, dojoTracker, /*depth subscribe place*/2));
                    proxyFactory.proxyFunction(context, mod, "unsubscribe", this._proxyUnsubscribeWidgetBase(context, dojo, dojoAccess, dojoDebugger, dojoTracker), null);                   
                    proxyFactory.proxyFunction(context, mod, "disconnect", this._proxyDisconnectWidgetBase(context, dojo, dojoAccess, dojoDebugger, dojoTracker), null);
                    // FIXME Replace this hack fix for a communication mechanism based on events.
                    DojoProxies.protectProxy(context, mod, 'subscribe', 'unsubscribe', 'connect', 'disconnect');

                    if(FBTrace.DBG_DOJO) {
                        FBTrace.sysout("_WidgetBase wrapped successfully");
                    }

                    //trace
                    this._fbTraceConnectionsNotTracked(context);

                } catch(e) {
                    FBTrace.sysout("error while trying to inject wrappers to _WidgetBase.js: ", e);
                }
            }           
        },
        
       
      _connectPreviousAdviceWidgetBase: function(context, dojo, dojoAccess, dojoDebugger, dojoTracker) {
          if(FBTrace.DBG_DOJO) {
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
          if(FBTrace.DBG_DOJO) {
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
          if(FBTrace.DBG_DOJO) {
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
      },
      
      _proxySubscribeWidgetBase : function(context, dojo, dojoAccess, dojoDebugger, dojoTracker, stackDepthForSubPlace) {

          if(FBTrace.DBG_DOJO) {
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
         if(FBTrace.DBG_DOJO) {
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
     }


    });
    
    
    /***************************************************************************
     * ****************************************************************************
     * ****************************************************************************
     */    
    //connect/subscribe methods are defined in dojo/_base/connect and dijit/_WidgetBase
    DojoHooks.DojoProxiesInitializer17PreBeta5 = function() {
        if(FBTrace.DBG_DOJO) {
            FBTrace.sysout("DOJO DojoProxiesInitializer for dojo 1.7 [beta1, beta5) created");
        }
    };
    DojoHooks.DojoProxiesInitializer17PreBeta5.prototype = Obj.extend(DojoHooks.DojoProxiesInitializer17Base.prototype, {

        /* created for rad support */
        
        onCompilationUnit: function (context, url, kind, dojo, proxyFactory, dojoAccess, dojoDebugger, dojoTracker) {
            //hack: need to bypass oncompilationUnit method from superclass because this impl needs to proxy "_connect" and not "connect"
            
            DojoHooks.DojoProxiesInitializer.prototype.onCompilationUnit.apply(this, arguments);
            
            //let's wrap _WidgetBase functions (connect, subscribe..) as well ..
            this.injectProxiesWidgetBase(context, dojo, proxyFactory, dojoAccess, dojoDebugger, dojoTracker);
        },

        injectProxiesDojoGlobal: function(context, dojo, proxyFactory, dojoAccess, dojoDebugger, dojoTracker) {
            
            if(FBTrace.DBG_DOJO) {
                FBTrace.sysout("injecting wrappers to dojo global (older version , with _connect)");
            }

            proxyFactory.proxyFunction(context, dojo, "_connect", null, this._proxyConnect(context, dojo, dojoAccess, dojoDebugger, dojoTracker, 2));
            proxyFactory.proxyFunction(context, dojo, "disconnect", this._proxyDisconnect(context, dojo, dojoAccess, dojoDebugger, dojoTracker), null);
            proxyFactory.proxyFunction(context, dojo, "subscribe", null, this._proxySubscribe(context, dojo, dojoAccess, dojoDebugger, dojoTracker, 1));
            proxyFactory.proxyFunction(context, dojo, "unsubscribe", this._proxyUnsubscribe(context, dojo, dojoAccess, dojoDebugger, dojoTracker), null);
            
            // FIXME[BugTicket#91]: Replace this hack fix for a communication mechanism based on events.
            DojoProxies.protectProxy(context, '_connect', 'disconnect', 'subscribe', 'unsubscribe');
        },

        injectProxiesConnectModule: function(context, dojo, proxyFactory, dojoAccess, dojoDebugger, dojoTracker) {
            //nothing to do         
        },
        
        _getWidgetBaseModule: function(context) {
            return this._getModule(context, 'dijit*_WidgetBase');
        }

       
    });
    
    /***************************************************************************
     * ****************************************************************************
     * ****************************************************************************
     */    
    DojoHooks.DojoProxiesInitializer17 = function() {
        if(FBTrace.DBG_DOJO) {
            FBTrace.sysout("DOJO DojoProxiesInitializer for dojo 1.7 created");
        }
    };
    DojoHooks.DojoProxiesInitializer17.prototype = Obj.extend(DojoHooks.DojoProxiesInitializer17Base.prototype, {

        //dojo 1.7 release , with Evented , on, aspect, and more 


    });




    return DojoHooks;
});