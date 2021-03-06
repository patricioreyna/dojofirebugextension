/* Released under BSD license (see license.txt) */


/**
 * dojo hooks. Hooks into dojo (e.g connect and subscribe operations) and
 * creates proxies to gather information from app usage.
 * There is a hierarchy to cope with the different dojo versions.
 * 
 * @author preyna@ar.ibm.com
 */
define([
        "firebug/lib/object",
        "firebug/lib/trace",
        "firebug/lib/wrapper",
        "dojo/core/dojoaccess",
        "dojo/core/dojomodel",
        "dojo/core/prefs",
        "dojo/core/proxies",       
        "dojo/lib/utils"/*,
        "dojo/core/trace-error-log" //must be the last item always */
       ], function dojoHooksFactory(Obj, FBTrace, Wrapper, DojoAccess, DojoModel, DojoPrefs, DojoProxies, DojoUtils)
{

    //FIXME refactor this file into smaller ones
    
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
        var req = DojoAccess._getRequireJS(context);
        
        if(req && req.async) {
            impl = new DojoHooks.DojoProxiesInitializer17();

        } else { 

            var version = DojoAccess.Version.prototype.fromDojoVersion(dojoVersion);
           
            var pivotDojo17 = DojoAccess.Version.prototype.fromVersionString("1.7.0");
            var pivotDojo17RC = DojoAccess.Version.prototype.fromVersionString("1.7.0rc1");
            var pivotDojo17Beta5 = DojoAccess.Version.prototype.fromVersionString("1.7.0b5");
            var pivot17PreDojoBeta5 = DojoAccess.Version.prototype.fromVersionString("1.7.0b1");
            
            
            if(version.compare(pivotDojo17, /*strict comparison*/true) >= 0) {
                impl = new DojoHooks.DojoProxiesInitializer17();
            } if(version.compare(pivotDojo17RC, /*strict comparison*/true) >= 0) {
                impl = new DojoHooks.DojoProxiesInitializer17();
            } else if(version.compare(pivotDojo17Beta5, /*strict comparison*/true) >= 0) {
                impl = new DojoHooks.DojoProxiesInitializer17Base();
            } else if(version.compare(pivot17PreDojoBeta5, /*strict comparison*/true) >= 0) {
                impl = new DojoHooks.DojoProxiesInitializer17PreBeta5();
            } else {
                //older dojo versions (<= 1.6.x)
                impl = new DojoHooks.DojoProxiesInitializer();
            }
        }
        } catch(e) {
            if(FBTrace.DBG_DOJO) {
                FBTrace.sysout(e);
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
            
            /**
             * tracing function used to undertand how many connections were created by "this extesnion" (wrappers, proxies, etc)
             * and that are not being tracked by the info side panel.
             * This function is only useful when used together with the "-tweaked" dojo distributions (which count the created conns, subs, and more).
             */
            _fbTraceConnectionsNotTracked: function(context) {
                if(FBTrace.DBG_DOJO_CONN_COUNTER) {
                    var conn_counter = Wrapper.unwrapObject(context.window).connections || 0;
                    var subs_counter = Wrapper.unwrapObject(context.window).subscriptions || 0;
                    FBTrace.sysout("connections original value (prev to tracking): " + conn_counter);
                    FBTrace.sysout("subscriptions original value (prev to tracking): " + subs_counter);
                    
                    //dojo 1.7 specifics...
                    var on_counter = Wrapper.unwrapObject(context.window).on_count || 0;
                    var evented_counter = Wrapper.unwrapObject(context.window).evented || 0;
                    FBTrace.sysout("evented original value (prev to tracking): " + evented_counter);
                    FBTrace.sysout("on_count original value (prev to tracking): " + on_counter);
                }
            },
            
            injectProxies: function(context, dojo, proxyFactory, dojoAccess, dojoDebugger, dojoTracker) {

                if (!context.connectHooked && dojo && dojo.connect) {
                    context.connectHooked = true;

                    this.injectProxiesDojoGlobal(context, dojo, proxyFactory, dojoAccess, dojoDebugger, dojoTracker);
                    
                    //trace
                    this._fbTraceConnectionsNotTracked(context);
                }

                var dojox = DojoAccess._dojox(context);
                if (!context.gfxHooked && dojox && dojox.gfx && dojox.gfx.shape && dojox.gfx.shape.Surface && dojox.gfx.shape.Container) {
                    context.gfxHooked = true;

                    this.injectProxiesGFX(context, dojo, dojox, proxyFactory, dojoAccess, dojoDebugger, dojoTracker);
                    if(FBTrace.DBG_DOJO) {
                        FBTrace.sysout("DOJO GFX TRACKED !");
                    }
                }
                
            },

            injectProxiesGFX: function(context, dojo, dojox, proxyFactory, dojoAccess, dojoDebugger, dojoTracker) {
                
                if(FBTrace.DBG_DOJO) {
                    FBTrace.sysout("injecting wrappers to dojox.gfx.shape.Surface global");
                }

                proxyFactory.proxyFunction(context, dojox.gfx.shape.Container, "_init", null, this._proxyGfxSurfaceConstructor(context, dojox.gfx.shape.Container, dojoAccess, dojoDebugger, dojoTracker));
                proxyFactory.proxyFunction(context, dojox.gfx.shape.Surface.prototype, "destroy", this._proxyGfxSurfaceDestructor(context, dojox.gfx.shape.Surface.prototype, dojoAccess, dojoDebugger, dojoTracker), null);
                proxyFactory.proxyFunction(context, dojox.gfx.shape.Container, "add", null, this._proxyGfxContainerModified(context, dojox.gfx.shape.Container, dojoAccess, dojoDebugger, dojoTracker));
                proxyFactory.proxyFunction(context, dojox.gfx.shape.Container, "remove", null, this._proxyGfxContainerModified(context, dojox.gfx.shape.Container, dojoAccess, dojoDebugger, dojoTracker));
                proxyFactory.proxyFunction(context, dojox.gfx.shape.Container, "clear", null, this._proxyGfxContainerModified(context, dojox.gfx.shape.Container, dojoAccess, dojoDebugger, dojoTracker));
                proxyFactory.proxyFunction(context, dojox.gfx.shape.Container, "_moveChildToFront", null, this._proxyGfxContainerModified(context, dojox.gfx.shape.Container, dojoAccess, dojoDebugger, dojoTracker));
                proxyFactory.proxyFunction(context, dojox.gfx.shape.Container, "_moveChildToBack", null, this._proxyGfxContainerModified(context, dojox.gfx.shape.Container, dojoAccess, dojoDebugger, dojoTracker));
                
                
                // FIXME[BugTicket#91]: Replace this hack fix for a communication mechanism based on events.
                DojoProxies.protectProxy(context, dojox.gfx.shape.Container, '_init', "add", "remove", "clear", "_moveChildToFront", "_moveChildToBack");
                DojoProxies.protectProxy(context, dojox.gfx.shape.Surface.prototype, 'destroy');
            },

            _proxyGfxSurfaceConstructor: function(context, containerProto, dojoAccess, dojoDebugger, dojoTracker) {

                if(FBTrace.DBG_DOJO) {
                    FBTrace.sysout("DOJO GFX creating gfx surface proxy");
                    
                }

                var self = this;
                return function(ret, args) {
                   
                    if(FBTrace.DBG_DOJO_DBG) {                        
                        FBTrace.sysout("DOJO DEBUG: Surface's constructor invoked with this args and result: ", { 'args':args, 'ret':ret});
                    }

                    dojoAccess.trackGFXSurface(this, context);
                };
            },
            _proxyGfxSurfaceDestructor: function(context, surfaceProto, dojoAccess, dojoDebugger, dojoTracker) {

                if(FBTrace.DBG_DOJO) {
                    FBTrace.sysout("DOJO GFX creating gfx surface proxy for destroy");
                    
                }

                var self = this;
                return function(ret, args) {
                   
                    if(FBTrace.DBG_DOJO_DBG) {                        
                        FBTrace.sysout("DOJO DEBUG: Surface's destroy invoked with this args and result: ", { 'args':args, 'ret':ret});
                    }

                    dojoAccess.untrackGFXSurface(this, context);
                };
            },
            _proxyGfxContainerModified: function(context, containerProto, dojoAccess, dojoDebugger, dojoTracker) {
                if(FBTrace.DBG_DOJO) {
                    FBTrace.sysout("DOJO GFX creating gfx container proxy");
                    
                }

                var self = this;
                return function(ret, args) {
                   
                    if(FBTrace.DBG_DOJO_DBG) {                        
                        FBTrace.sysout("DOJO DEBUG: Container's modificationmethod invoked with this args and result: ", { 'args':args, 'ret':ret});
                    }
                    dojoAccess.gfxContainerStructureModified(this, context);
                };                
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
                
                   var originalFunction = self._findConnectionOriginalFunction(obj, event);
                       
                   dojoTracker.trackObserver(ret, new DojoModel.Connection(obj, event, handlerContext, method, originalFunction, dontFix, callerInfo));                   
                   return ret;
                };
            },

            /*Function|null*/_findConnectionOriginalFunction: function(obj, event) {
                var originalFunction = null;
                try {
                    if(event.call) {
                        //event is a function (dojo 1.7) 
                        originalFunction = event;
                    } else {                     
                        //event is string
                        //$$HACK if using dojo 1.7's connect based on 'advices', then we disable Break on Event.
                        //(or ..we could try finding the oroginal function in the advices chain)
                        //TODO or we could ask dojo guys to make the event "visible" to us.
                        if(obj[event] && obj[event]['target']) {
                            originalFunction = obj[event]['target'];
                        } else {
                            //it's a wrapper and it doesn't provide access to orginal target
                            originalFunction = null;
                            //|| obj[event]['after']
                        }       
                    }
                    
                } catch (exc) {
                    //should not be here...
                    if(FBTrace.DBG_DOJO_DBG) {
                        FBTrace.sysout("DOJO DEBUG: error bypassed while adding connection", exc);
                    }
                }
                return originalFunction;                
            },
            
           _proxyDisconnect : function(context, dojo, dojoAccess, dojoDebugger, dojoTracker){
                if(FBTrace.DBG_DOJO) {
                    FBTrace.sysout("DOJO creating proxyDisconnect");
                }

                return function(handle) {
                    if(FBTrace.DBG_DOJO_DBG) {
                        FBTrace.sysout("DOJO DEBUG executing proxyDisconnect with arguments: ", arguments);
                    }

                    dojoTracker.untrackObserver(Wrapper.unwrapObject(handle));
                    //dojoTracker.removeConnection(Wrapper.unwrapObject(handle));
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
                   
                   dojoTracker.trackObserver(ret, new DojoModel.Subscription.prototype.createSubscription(topic, scope, method, callerInfo));                   
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

                   dojoTracker.untrackObserver(Wrapper.unwrapObject(handle));
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
            if(FBTrace.DBG_DOJO_DBG) {
                FBTrace.sysout("COMP UNIT: " + url);
            }
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
                FBTrace.sysout("injecting wrappers to dojo global if needed....");
            }

            if(!dojo.connect) {
                return;
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
            if(FBTrace.DBG_DOJO) {
                FBTrace.sysout("_getModule: " + moduleName);
            }

            return DojoAccess._getModule(moduleName, context);
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
                    //as the caller function
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
              //Watch out this code! Is there a potential problem of different connects? (in the future, with multi-process?)
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
             
             var originalFunction = self._findConnectionOriginalFunction(obj, event);
             dojoTracker.trackObserver(ret, new DojoModel.Connection(obj, event, handlerContext, method, originalFunction, dontFix, callerInfo));
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

              dojoTracker.untrackObserver(Wrapper.unwrapObject(handle));
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

             dojoTracker.trackObserver(ret, new DojoModel.Subscription.prototype.createSubscription(topic, scope, method, callerInfo));

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
            
            dojoTracker.untrackObserver(Wrapper.unwrapObject(handle));
            
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
        this.stackDepthForDojoValueHolder = { value: 2 };
        this.waitingModules = {}; //map of (mid, moduleExecutedCallback)
        this.requireListener = null;
    };
    DojoHooks.DojoProxiesInitializer17.prototype = Obj.extend(DojoHooks.DojoProxiesInitializer17Base.prototype, {


        _getModule: function(context, moduleName, moduleExecutedCallback) {
            /*
             moduleExecutedCallback function has 2 arguments: mid and module, where module will be the 'executed' module 
             (i.e. req.modules[mid].result)
             The moduleExecutedCallback will be invoked with "this" (dojohooks instance) as execution context
            */

            var module = DojoAccess._getModule(moduleName, context);            
            var res = null;
            if(module) {
                //the module was already executed!
                res = module.result;
                if(moduleExecutedCallback) {
                    moduleExecutedCallback.call(this, moduleName, module);    
                }                
            
            } else if(arguments.length > 2) {
                
                res = null;                
                var w = Wrapper.unwrapObject(context.window);
                
                //register callback            
                if(!this.waitingModules[moduleName]) {
                    //UNSECURE  
                    if(FBTrace.DBG_DOJO) {
                        FBTrace.sysout("ASYNC LOAD REQUEST for:" + moduleName + " " + moduleExecutedCallback, moduleExecutedCallback);
                    }

                    this.waitingModules[moduleName] = moduleExecutedCallback;
                }

                //initialize our require listener (if not initialized already)
                if(!this.requireListener) {

                    var self = this;
                    var require = DojoAccess._getRequireJS(context);            
                    
                    var listener = (function() {
                        //var callback = moduleExecutedCallback; 
                        return function(type, mid) {
                            if(type != "loader-finish-exec") {
                                return;
                            }                    
                            if(self.waitingModules[mid]) {
                                //we were waiting for this module to be executed!
                                
                                var callback = self.waitingModules[mid];
                                if(callback) {                        
                                    //impl note: we don't invoke DojoAccess._getModule here because it expects module.executed to be true, and at
                                    //this point is was just executed but the executed flag not set yet.
                                    var module = require.modules && require.modules[mid];
                                    if(module && module.result) {
                                        callback.call(self, mid, module.result);
                                        self.waitingModules[mid] = "done";                                        
                                    }
                                }  
                            }
                        }
                    })();

                    listener.internalClass = "dojoext-added-code";
                    DojoUtils._addMozillaExecutionGrants(listener);
                    var handle = require.on("trace", listener);                        
                    this.requireListener = listener;
                }

            }
            return res;
        },
      
        getGlobalScope: function(context) {
            var kernel = this._getModule(context, 'dojo/_base/kernel');
            if(!kernel) {
                kernel = DojoAccess._dojo(context);
            }
            return kernel && kernel.global;
        },

        injectProxies: function(context, dojo, proxyFactory, dojoAccess, dojoDebugger, dojoTracker) {
            // if(FBTrace.DBG_DOJO) {
            //     FBTrace.sysout("DOJO DojoProxiesInitializer17 inject proxies called");
            // }

            this.injectProxiesToOnAspectModules(context, proxyFactory, dojoAccess, dojoDebugger, dojoTracker);
            this.injectProxiesToTopicModule(context, proxyFactory, dojoAccess, dojoDebugger, dojoTracker);                
            this.injectProxiesConnectModule(context, proxyFactory, dojoAccess, dojoDebugger, dojoTracker);
            this.injectProxiesDojoGlobal(context, dojo, proxyFactory, dojoAccess, dojoDebugger, dojoTracker);            

            //let's wrap _WidgetBase functions (connect, subscribe..) as well ..
            this.injectProxiesWidgetBase(context, proxyFactory, dojoAccess, dojoDebugger, dojoTracker);
            this.checkWidgetModuleLoaded(context, proxyFactory, dojoAccess, dojoDebugger, dojoTracker);            

            //trace
            this._fbTraceConnectionsNotTracked(context);

            //GFX hooks!
            this.injectProxiesGFX(context, proxyFactory, dojoAccess, dojoDebugger, dojoTracker);
        },

        /**
         * wraps the given handle/signal's remove function with custom "untracking" code
         */
        _createRemove: function(dojoTracker, handle) {

            if(FBTrace.DBG_DOJO_DBG_HANDLES) {
                FBTrace.sysout("creating signal.remove advise");
            }
            var originalRemoveFunction = handle.remove;
            handle.remove = function() {
                if(FBTrace.DBG_DOJO_DBG_HANDLES) {
                    FBTrace.sysout("executing adviced signal.remove method");
                }
                dojoTracker.untrackObserver(handle);
                originalRemoveFunction.apply(this);
            };            
            DojoUtils._addMozillaClientAccess(handle, ['remove']);
            DojoUtils._addMozillaExecutionGrants(handle.remove);           
            
            return handle;
        },

        injectProxiesDojoGlobal: function(context, dojo, proxyFactory, dojoAccess, dojoDebugger, dojoTracker) {
            if(FBTrace.DBG_DOJO_DBG) {
                FBTrace.sysout("injecting wrappers to dojo global if needed....");
            }

            if(context.dojoGlobalWrapped || !dojo || !dojo.connect) {
                return;
            }
            context.dojoGlobalWrapped = true;
            
            if(FBTrace.DBG_DOJO) {
                FBTrace.sysout("injecting wrappers to dojo global");
            }
            // hook on dojo's connect
            this._createProxy(context, proxyFactory, dojoAccess, dojoDebugger, dojoTracker, dojo, "connect", "connectG", this.stackDepthForDojoValueHolder, this._proxyConnect(context, dojoAccess, dojoDebugger, dojoTracker));
            this._createProxy(context, proxyFactory, dojoAccess, dojoDebugger, dojoTracker, dojo, "subscribe", "subsG", this.stackDepthForDojoValueHolder, this._proxySubscribe(context, dojoAccess, dojoDebugger, dojoTracker));            
        },
    
        injectProxiesConnectModule: function(context, proxyFactory, dojoAccess, dojoDebugger, dojoTracker) {

            this._getModule(context, 'dojo/_base/connect', function(mid, connectModule) {

                if(!context.connectModuleWrapped && connectModule) {
                    context.connectModuleWrapped = true;

                    if(FBTrace.DBG_DOJO) {
                        FBTrace.sysout("injecting wrappers to connect module....", arguments);
                    }

                    this._createProxy(context, proxyFactory, dojoAccess, dojoDebugger, dojoTracker, connectModule, "connect", "connectM", this.stackDepthForDojoValueHolder, this._proxyConnect(context, dojoAccess, dojoDebugger, dojoTracker));
                    this._createProxy(context, proxyFactory, dojoAccess, dojoDebugger, dojoTracker, connectModule, "subscribe", "subsM", this.stackDepthForDojoValueHolder, this._proxySubscribe(context, dojoAccess, dojoDebugger, dojoTracker));
                }
            });            
        },

        _createProxy: function(context, proxyFactory, dojoAccess, dojoDebugger, dojoTracker, module, originalFnName, fnDisplayName, callerStackDepth, postFn) {

            proxyFactory.proxyFunction(context, module, originalFnName, this._proxyPreExec(context, dojoAccess, dojoDebugger, dojoTracker, callerStackDepth, true, fnDisplayName), this._postFunctionExecutor(context, dojoTracker, postFn));
        },
        
        injectProxiesToOnAspectModules: function(context, proxyFactory, dojoAccess, dojoDebugger, dojoTracker) {                

                this._getModule(context, 'dojo/aspect', function(mid, mod) {

                    if(!context.aspectModuleWrapped && mod) {
                        context.aspectModuleWrapped = true;
                    
                        //after(target, methodName, advice, receiveArguments){}
                        if(FBTrace.DBG_DOJO) {
                            FBTrace.sysout("injecting wrappers to module: dojo/aspect", arguments);
                        }

                        this._createProxy(context, proxyFactory, dojoAccess, dojoDebugger, dojoTracker, mod, "before", "before", 2, this._proxyAspect("before", context, dojoAccess, dojoDebugger, dojoTracker));
                        this._createProxy(context, proxyFactory, dojoAccess, dojoDebugger, dojoTracker, mod, "after", "after", 2, this._proxyAspect("after", context, dojoAccess, dojoDebugger, dojoTracker));
                        this._createProxy(context, proxyFactory, dojoAccess, dojoDebugger, dojoTracker, mod, "around", "around", 2, this._proxyAspect("around", context, dojoAccess, dojoDebugger, dojoTracker));                
                    }

                });

        
            //on = function(target, type, listener, dontFix){...}
            //on.parse = function(target, type, listener, addListener, dontFix, matchesTarget){...}
            
            /*
             * On: ojo que "type" pueden ser varios events (string) separados por ",". En ese caso
             * el handle q se retorna es un "composite handle" (un array con los handles internos. cada uno con su "remove" correspondiente).
             * 
             * Tb type puede ser "selector:event", en cuyo caso se aplica un filter antes de invocar al listener.
             * 
             * OJO que se puede dar la secuencia "on.parse -> ... -> on.parse " (a mi me interesa "trackear" cuando "type" sea un string)
             */


                this._getModule(context, 'dojo/on', function(mid, mod) {

                    if(!context.onModuleWrapped && mod) {
                        context.onModuleWrapped = true;

                        if(FBTrace.DBG_DOJO) {
                            FBTrace.sysout("injecting wrappers to module: dojo/on", arguments);
                        }

                        //in this case we don't use _createProxy function because we need different parameters
                        proxyFactory.proxyFunction(context, mod, "parse", this._proxyPreExec(context, dojoAccess, dojoDebugger, dojoTracker, 3, false, "on.parse"), this._postFunctionExecutor(context, dojoTracker, this._proxyOnParsePostExec(context, dojoAccess, dojoDebugger, dojoTracker), this.EXECUTE.ALWAYS));
                    }
                });


        },
        
        injectProxiesToTopicModule: function(context, proxyFactory, dojoAccess, dojoDebugger, dojoTracker) {
            
            this._getModule(context, 'dojo/topic', function(mid, mod) {
                if(!context.topicModuleWrapped && mod) {
                    context.topicModuleWrapped = true;

                    if(FBTrace.DBG_DOJO) {
                        FBTrace.sysout("injecting wrappers to module: dojo/topic", arguments);
                    }
                    
                    this._createProxy(context, proxyFactory, dojoAccess, dojoDebugger, dojoTracker, mod, "subscribe", "topic.sub", 2, this._proxySubscribeTopicModule(context, dojoAccess, dojoDebugger, dojoTracker));
                }                
            });
         
        },

        injectProxiesWidgetBase: function(context, proxyFactory, dojoAccess, dojoDebugger, dojoTracker) {
            
            this._getModule(context, 'dijit/_WidgetBase', function(mid, widgetBaseModule) {
                if(!context.widgetBaseModuleWrapped && widgetBaseModule) {
                    context.widgetBaseModuleWrapped = true;
                    
                    if(FBTrace.DBG_DOJO) {
                        FBTrace.sysout("about to wrap dijit._WidgetBase", arguments);
                    }

                    try {
                        var mod = widgetBaseModule.prototype;
                        
                        this._createProxy(context, proxyFactory, dojoAccess, dojoDebugger, dojoTracker, mod, "connect", "connectWB", 2, this._proxyConnectWidgetBase(context, dojoAccess, dojoDebugger, dojoTracker));
                        this._createProxy(context, proxyFactory, dojoAccess, dojoDebugger, dojoTracker, mod, "subscribe", "subsWB", 2, this._proxySubscribeWidgetBase(context, dojoAccess, dojoDebugger, dojoTracker));                    

                        if(FBTrace.DBG_DOJO) {
                            FBTrace.sysout("_WidgetBase wrapped successfully");
                        }

                        //trace
                        this._fbTraceConnectionsNotTracked(context);

                    } catch(e) {
                        if(FBTrace.DBG_DOJO) {
                            FBTrace.sysout("error while trying to inject wrappers to _WidgetBase.js: ", e);
                        }
                    }
                }           

            });

        },

        checkWidgetModuleLoaded: function(context, proxyFactory, dojoAccess, dojoDebugger, dojoTracker) {
            
            var widgetModule = this._getModule(context, 'dijit/_Widget');            
            if(!context.widgetModuleWrapped && widgetModule) {
                context.widgetModuleWrapped = true;
                
                if(FBTrace.DBG_DOJO) {
                    FBTrace.sysout("DOJO applying fix due to widgetModule. Increasing in 1 stackDepth for connect module and global connections");
                }
                
                this.stackDepthForDojoValueHolder.value += 1;
            }
        },

        _proxyPreExec: function(context, dojoAccess, dojoDebugger, dojoTracker, stackDepth, dontTrackInOnParse, name) {
            
            if(FBTrace.DBG_DOJO) {
                FBTrace.sysout("DOJO creating _proxyOnParsePreExec");
            }
            name = name || "unnamed";
            var self = this;
            return function(args) {
                try{
                context.dojoextProxyChain = (context.dojoextProxyChain || 0) + 1;

                if(FBTrace.DBG_DOJO_DBG) {
                    FBTrace.sysout("DOJO executing _proxyOnParsePreExec '"+name+"' with context.dojoextProxyChain= " + context.dojoextProxyChain + " ,dontTrackInOnParse=" + dontTrackInOnParse + " and arguments: ", args);
                }

                
                if(dontTrackInOnParse) {
                    context.dojoext_on_proxy_donot_track = true;
                }
                
                
                if(FBTrace.DBG_DOJO_DBG) {
                    FBTrace.sysout("DOJO DEBUG executing _proxyOnParsePreExec with arguments: ", args);
                }

                if(context.dojoextProxyChain == 1) {
                    //this is the outer most on.parse proxy. let's compute the caller
                    var stackDepthValue = (typeof stackDepth == "object" ? stackDepth.value : stackDepth) || 0;
                    var callerInfo = (context.initialConfig.breakPointPlaceSupportEnabled) ? dojoDebugger.getDebugInfoAboutCaller(context, stackDepthValue) : null;
                    context.dojoextProxyChain_InfoAboutCaller = callerInfo;
                    if(FBTrace.DBG_DOJO_DBG && callerInfo) {
                        FBTrace.sysout("DOJO callerInfo sourceFile=" + callerInfo.scriptInfo.sourceFile + " lineNo=" + callerInfo.scriptInfo.lineNo);
                    }

                }
                } catch(error) {
                    if(FBTrace.DBG_DOJO) {
                        FBTrace.sysout("DOJO ERROR: _proxyOnParsePreExec", error);
                    }
                }
                
            }
        },
        
        EXECUTE: {
            ALWAYS: 0,
            ONLY_IF_FIRST_IN_CHAIN: 1
        },
        _postFunctionExecutor: function(context, dojoTracker, postFn, /* EXECUTE.* */ when) {
            if(FBTrace.DBG_DOJO) {               
                FBTrace.sysout("_postFunctionExecutor for " + postFn.dojoext_name + " when=" + when);
                FBTrace.sysout("_postFunctionExecutor ALWAYS" + this.EXECUTE.ALWAYS + " first only=" + this.EXECUTE.ONLY_IF_FIRST_IN_CHAIN);
            }

            
            if(when === undefined) {
                when = this.EXECUTE.ONLY_IF_FIRST_IN_CHAIN;
            }    
            var name = postFn.dojoext_name || "unnamed";
            var self = this;
            return function(ret, args) {               
                try {
                    context.dojoextProxyChain = (context.dojoextProxyChain || 1) - 1;              
                    if((when == self.EXECUTE.ONLY_IF_FIRST_IN_CHAIN) && context.dojoextProxyChain > 0) {                  
                         if(FBTrace.DBG_DOJO_DBG) {
                             FBTrace.sysout("DOJO "+name+" coming from OtherProxy. Ignoring...", args);
                             FBTrace.sysout("DOJO "+name+" - context.dojoextProxyChain = " + context.dojoextProxyChain);
                         }
                         return ret;
                    }

                    if(FBTrace.DBG_DOJO_DBG) {                        
                        FBTrace.sysout("DOJO DEBUG: "+name+" proxy . executing....context.dojoextProxyChain = " + context.dojoextProxyChain, args);
                    }

                    var result = postFn.call(this, ret, args);

                    if(FBTrace.DBG_DOJO_DBG) {                        
                        FBTrace.sysout("DOJO DEBUG: "+name+" proxy . After the execution of postFN....context.dojoextProxyChain = " + context.dojoextProxyChain, args);
                    }
                  
                    //clean context                    
                    if(context.dojoextProxyChain == 0) {
                        if(context.dojoext_on_proxy_donot_track) { 
                            delete context.dojoext_on_proxy_donot_track;    
                        }
                        if(context.dojoextProxyChain_InfoAboutCaller) {
                            delete context.dojoextProxyChain_InfoAboutCaller;    
                        }                        
                        if(context.dojoext_on_proxy_tracked) { 
                            if(FBTrace.DBG_DOJO_DBG) {                        
                                FBTrace.sysout("DOJO DEBUG: outest "+name+" proxy . Cleaning context. ", { 'args':args, 'signal':ret});
                            }
                            //clean context
                            delete context.dojoext_on_proxy_tracked;
                        }                        
                        
                        result = self._createRemove(dojoTracker, result);                                  
                    }
                    

                    return result;

                } catch(error) {
                    if(FBTrace.DBG_DOJO) {
                        FBTrace.sysout("DOJO ERROR in pre-"+name, error);
                    }
                }
            };
        },

        _proxySubscribe: function(context, dojoAccess, dojoDebugger, dojoTracker, stackDepthForSubPlace){            
            if(FBTrace.DBG_DOJO) {
                FBTrace.sysout("DOJO creating _proxySubscribe");
            }
                        
            var self = this;
            var globalScope = this.getGlobalScope(context);
            var fn = function(ret, args) {
               
                //subscribe:function(topic, handlerContext, method){...}     

               //FIXME[BugTicket#91]: Defensive code to avoid registering
               if (args[2] && args[2].internalClass == 'dojoext-added-code') {
                   if(FBTrace.DBG_DOJO) {                        
                       FBTrace.sysout("DOJO DEBUG: _proxySubscribe tried to wrap a 'dojoext-added-code'! ", { 'args':args, 'signal':handle});
                   }
                   return handle; 
               }

               var topic = Wrapper.unwrapObject(args[0]);
               var handlerContext = Wrapper.unwrapObject(args[1]);
               var method = Wrapper.unwrapObject(args[2]);                    

               // mimic dojo.hitch logic regarding missing (omitted)
               // context argument
               if(!method){
                   method = handlerContext;
                   handlerContext = null;
               }              
               if (!handlerContext) {                    
                    // handlerContext = (typeof(method) == 'string') ? globalScope : dojo;
                   if(FBTrace.DBG_DOJO) {                        
                       FBTrace.sysout("DOJO DEBUG: _proxySubscribe: assigning globalScope as handlerContext value ", { 'globalScope': globalScope} );
                   }
                    handlerContext = globalScope;
               }

               dojoTracker.trackObserver(ret, new DojoModel.Subscription.prototype.createSubscription(topic, handlerContext, method, (context.dojoextProxyChain_InfoAboutCaller || null)));

               if(FBTrace.DBG_DOJO_DBG) {                        
                   FBTrace.sysout("DOJO DEBUG: _proxySubscribe tracked. ", args);
               }
               
               return ret;
          };
          fn.dojoext_name = "_proxySubscribe";
          return fn;
       },
       
       _proxySubscribeTopicModule : function(context, dojoAccess, dojoDebugger, dojoTracker, stackDepthForSubPlace){

            if(FBTrace.DBG_DOJO) {
                FBTrace.sysout("DOJO creating proxySubscribeTopic");
            }

           var self = this;
           var fn = function(ret, args) {  
               try {
               
                   //subscribe: function(topic, listener){...}
                   
                   //FIXME[BugTicket#91]: Defensive code to avoid registering
                   if (args[1] && args[1].internalClass == 'dojoext-added-code') {
                       if(FBTrace.DBG_DOJO) {                        
                           FBTrace.sysout("DOJO DEBUG: _proxySubscribeTopicModule tried to wrap a 'dojoext-added-code'! ", { 'args':args, 'signal':handle});
                       }
                       return handle; 
                   }
    
                   var topic = Wrapper.unwrapObject(args[0]);
                   var listener = Wrapper.unwrapObject(args[1]);                    
                   
                   dojoTracker.trackObserver(ret, new DojoModel.Subscription.prototype.createTopicSubscription(topic, listener, (context.dojoextProxyChain_InfoAboutCaller || null)));
                   if(FBTrace.DBG_DOJO_DBG) {                        
                       FBTrace.sysout("DOJO DEBUG: _proxySubscribeTopicModule tracked. ", args);
                   }
                   return ret;

               } catch(error) {
                   if(FBTrace.DBG_DOJO) {
                       FBTrace.sysout("DOJO ERROR: _proxySubscribeTopicModule ", error);
                   }
               }
          };
          fn.dojoext_name = "_proxySubscribeTopicModule";
          return fn;
       },
       
       _proxyAspect: function(aspectType, context, dojoAccess, dojoDebugger, dojoTracker, stackDepth) {

           if(FBTrace.DBG_DOJO) {
               FBTrace.sysout("DOJO creating proxyAspect: " + aspectType, {'dojoAccess':dojoAccess, 'dojoTracker': dojoTracker, 'dojoDebugger':dojoDebugger});
               
           }

           var self = this;
           var fn = function(handle, args) {
              
               if(FBTrace.DBG_DOJO_DBG) {                        
                   FBTrace.sysout("DOJO DEBUG: aspect " + aspectType + "invoked with this args and result: ", { 'args':args, 'signal':handle});
               }

               //function after(target, methodName, advice, receiveArguments){}  (from dojo/aspect.js)
               
              // FIXME[BugTicket#91]: Defensive code to avoid registering
               // a connection made as part of a hack solution.
              if (args[2] && args[2].internalClass == 'dojoext-added-code') {
                  if(FBTrace.DBG_DOJO) {                        
                      FBTrace.sysout("DOJO DEBUG: aspect " + aspectType + " tried to wrap a 'dojoext-added-code'! ", { 'args':args, 'signal':handle});
                  }
                  return handle; 
              }
       
              var target =  Wrapper.unwrapObject(args[0]);
              var methodName = Wrapper.unwrapObject(args[1]);
              var advice = Wrapper.unwrapObject(args[2]);
                           
              var originalFn = self._findConnectionOriginalFunction(target, methodName);
              
              dojoTracker.trackObserver(handle, new DojoModel.OnAspectObserver(target, methodName, advice, originalFn, (context.dojoextProxyChain_InfoAboutCaller || null)));
              if(FBTrace.DBG_DOJO_DBG) {                        
                  FBTrace.sysout("DOJO DEBUG: aspect " + aspectType + " tracked. ", args);
              }

              return handle;
           };
           fn.dojoext_name = "aspect " + aspectType;
           return fn;           
       },
       
       _proxyOnParsePostExec: function(context, dojoAccess, dojoDebugger, dojoTracker, stackDepth) {

           if(FBTrace.DBG_DOJO) {
               FBTrace.sysout("DOJO creating proxyOnParse", {'dojoAccess':dojoAccess, 'dojoTracker': dojoTracker, 'dojoDebugger':dojoDebugger});
               
           }

           var self = this;
           var fn = function(handle, args) {
               if(context.dojoext_on_proxy_donot_track) {
                   if(FBTrace.DBG_DOJO_DBG) {
                       FBTrace.sysout("DOJO coming _proxyOnParsePostExec from OtherProxy with 'dojoext_on_proxy_donot_track'. Ignoring...", args);
                       FBTrace.sysout("_proxyOnParsePostExec context.dojoextProxyChain: " + context.dojoextProxyChain);
                   }
                   return handle;
               }
               
               if(context.dojoext_on_proxy_tracked) {
                   return handle;
               }
               
               //just some consistency checks
               if(FBTrace.DBG_DOJO && context.dojoextProxyChain < 0) {
                   FBTrace.sysout("DOJO ERROR in on.parse. context.dojoextProxyChain < 0 . This shouldnt have happened", { 'args':args, 'signal':handle});
               }

               //on.parse = function(target, type, listener, addListener, dontFix, matchesTarget){...}
              
               //ok, should we track ? only if type is a string (which means, this is the deepest on.parse proxy
               if(FBTrace.DBG_DOJO_DBG) {                        
                   FBTrace.sysout("DOJO DEBUG: on.parse invoked with this args and result: ", { 'args':args, 'signal':handle});
               }
               
               // FIXME[BugTicket#91]: Defensive code to avoid registering a connection made as part of a hack solution.
               if (args[2] && args[2].internalClass == 'dojoext-added-code') {
                   if(FBTrace.DBG_DOJO) {                        
                       FBTrace.sysout("DOJO DEBUG: on.parse tried to wrap a 'dojoext-added-code'! ", { 'args':args, 'signal':handle});
                   }
                   return handle; 
               }
       
               var target =  Wrapper.unwrapObject(args[0]);
               var type = Wrapper.unwrapObject(args[1]);
               var listener = Wrapper.unwrapObject(args[2]);

               //consistency check
               if(FBTrace.DBG_DOJO && typeof type != "string") {
                   FBTrace.sysout("context.dojoextProxyChain: " + context.dojoextProxyChain + ". Current onAspectCount: " + DojoModel.onAspectNumber + " . type: " + type);
                   FBTrace.sysout("DOJO ERROR in on.parse. Type argument wasn't a string. ", { 'args':args, 'signal':handle});
               }

               var originalFn = self._findConnectionOriginalFunction(target, type);
               dojoTracker.trackObserver(handle, new DojoModel.OnAspectObserver(target, type, listener, originalFn, (context.dojoextProxyChain_InfoAboutCaller || null)));
               context.dojoext_on_proxy_tracked = true;
               
               if(FBTrace.DBG_DOJO_DBG) {
                   FBTrace.sysout("DOJO DEBUG: on.parse tracked. context.dojoextProxyChain="+context.dojoextProxyChain, args);
               }
               return handle;
           };
           fn.dojoext_name = "on.parse";
           return fn;
       },
       
       _proxyConnect: function(context, dojoAccess, dojoDebugger, dojoTracker, stackDepthForConnectPlace) {

           if(FBTrace.DBG_DOJO) {
               FBTrace.sysout("DOJO creating proxyConnect", {'dojoAccess':dojoAccess, 'dojoTracker': dojoTracker, 'dojoDebugger':dojoDebugger});
               
           }

           var self = this;
           var globalScope = this.getGlobalScope(context);
           var fn = function(ret, args) {
               // we need to normalize arguments (copied from dojo connect)
               args = self._normalizeConnectArguments.apply(this, args);                   

               //connect:function(obj, event, context, method, dontFix){...}
               
              // FIXME[BugTicket#91]: Defensive code to avoid registering
               // a connection made as part of a hack solution.
              if (args[3] && args[3].internalClass == 'dojoext-added-code') {
                  if(FBTrace.DBG_DOJO) {                        
                      FBTrace.sysout("DOJO DEBUG: Connect tried to wrap a 'dojoext-added-code'! ", { 'args':args, 'signal':handle});
                  }
                  return ret; 
              }
       
              //context.dojoext_on_proxy_donot_track
              var obj =  Wrapper.unwrapObject(args[0] || globalScope);            
              var event = Wrapper.unwrapObject(args[1]); //event can be a function in dojo 1.7                   

              /*
                * The context parameter could be null, in that case it will
                * be determined according to the dojo.hitch implementation.
                * See the dojo.hitch comment at [dojo
                * directory]/dojo/_base/lang.js and dojo.connect comment at
                * [dojo directory]/dojo/_base/connect.js
                */
              var handlerContext = args[2];
              var method = Wrapper.unwrapObject(args[3]);
              
              if (!handlerContext) {
                 if(method.call) {
                      handlerContext = obj;
                 } else {
                      handlerContext = globalScope;
                 }                   
              }
              handlerContext = Wrapper.unwrapObject(handlerContext);
                          
              var dontFix = Wrapper.unwrapObject((args.length >= 5 && args[4]) ? args[4] : null);

              var originalFunction = self._findConnectionOriginalFunction(obj, event);
              dojoTracker.trackObserver(ret, new DojoModel.Connection(obj, event, handlerContext, method, originalFunction, dontFix, (context.dojoextProxyChain_InfoAboutCaller || null)));
              if(FBTrace.DBG_DOJO_DBG) {                        
                  FBTrace.sysout("DOJO DEBUG: proxyConnect tracked. ", args);
              }
              return ret;
           };
           fn.dojoext_name = "proxyConnect";
           return fn;
       },

       _proxyConnectWidgetBase: function(context, dojoAccess, dojoDebugger, dojoTracker) {
           if(FBTrace.DBG_DOJO) {
               FBTrace.sysout("DOJO creating _proxyConnectWidgetBase");
           }

           var self = this;
           var globalScope = this.getGlobalScope(context);
           var fn = function(ret, args) {

               //connect: function(/*Object|null*/ obj, /*String|Function*/ event, /*String|Function*/ method){...}

              // FIXME[BugTicket#91]: Defensive code to avoid registering a connection made as part of a hack solution.
              if (args[2] && args[2].internalClass == 'dojoext-added-code') {
                   if(FBTrace.DBG_DOJO) {                        
                       FBTrace.sysout("DOJO DEBUG: returning from wrapper created wth proxyConnectWidgetBase since given method was a proxy as well", { 'args':args, 'ret':ret});
                   }
                  return ret; 
              }
       
              var obj =  Wrapper.unwrapObject(args[0] || globalScope);            
              var event = Wrapper.unwrapObject(args[1]); //it can be a function (dojo 1.7)
              var handlerContext = this; //the widget instance
              var method = Wrapper.unwrapObject(args[2]);
              var dontFix = null;

              var originalFunction = self._findConnectionOriginalFunction(obj, event);
              dojoTracker.trackObserver(ret, new DojoModel.Connection(obj, event, handlerContext, method, originalFunction, dontFix, (context.dojoextProxyChain_InfoAboutCaller || null)));
              if(FBTrace.DBG_DOJO_DBG) {                        
                  FBTrace.sysout("DOJO DEBUG: proxyConnectWidgetBase tracked. ", args);
              }
              
              return ret;
           };
           fn.dojoext_name = "proxyConnectWidgetBase";
           return fn;                 
       },

       _proxySubscribeWidgetBase : function(context, dojoAccess, dojoDebugger, dojoTracker, stackDepthForSubPlace) {

           if(FBTrace.DBG_DOJO) {
               FBTrace.sysout("DOJO creating proxySubscribeWidgetBase");
           }

           var self = this;
           var fn = function(ret, args) {

               //subscribe: function(t, method){...}
              
              // FIXME[BugTicket#91]: Defensive code to avoid registering a connection made as part of a hack solution.
              if (args[1] && args[1].internalClass == 'dojoext-added-code') {
                   if(FBTrace.DBG_DOJO) {                        
                       FBTrace.sysout("DOJO DEBUG: returning from wrapper created wth _proxySubscribeWidgetBase since given method was a proxy as well", { 'args':args, 'ret':ret});
                   }
                  return ret; 
              }

              var topic = Wrapper.unwrapObject(args[0]);
              var method = Wrapper.unwrapObject(args[1]);
              var scope = this; //the widget instance..                    
                                  
              dojoTracker.trackObserver(ret, new DojoModel.Subscription.prototype.createSubscription(topic, scope, method, (context.dojoextProxyChain_InfoAboutCaller || null)));
              if(FBTrace.DBG_DOJO_DBG) {                        
                  FBTrace.sysout("DOJO DEBUG: _proxySubscribeWidgetBase tracked. ", args);
              }              
              return ret;
         };
         fn.dojoext_name = "_proxySubscribeWidgetBase";
         return fn;
      },

      /* ****************************** GFX **************************** */
  
        injectProxiesGFX: function(context, proxyFactory, dojoAccess, dojoDebugger, dojoTracker) {
            
            this._getModule(context, 'dojox/gfx/shape', function(mid, mod) {

                if(!mod) {
                    return;
                }

                if (context.gfxHooked) {
                    return;
                }
                context.gfxHooked = true;
                                                
                if(FBTrace.DBG_DOJO) {
                    FBTrace.sysout("injecting wrappers to dojox.gfx.shape.Surface global", arguments);
                }

                proxyFactory.proxyFunction(context, mod.Container, "_init", null, this._proxyGfxSurfaceConstructor(context, dojoAccess, dojoDebugger, dojoTracker));
                proxyFactory.proxyFunction(context, mod.Surface.prototype, "destroy", this._proxyGfxSurfaceDestructor(context, dojoAccess, dojoDebugger, dojoTracker), null);
                proxyFactory.proxyFunction(context, mod.Container, "add", null, this._proxyGfxContainerModified(context, dojoAccess, dojoDebugger, dojoTracker));
                proxyFactory.proxyFunction(context, mod.Container, "remove", null, this._proxyGfxContainerModified(context, dojoAccess, dojoDebugger, dojoTracker));
                proxyFactory.proxyFunction(context, mod.Container, "clear", null, this._proxyGfxContainerModified(context, dojoAccess, dojoDebugger, dojoTracker));
                proxyFactory.proxyFunction(context, mod.Container, "_moveChildToFront", null, this._proxyGfxContainerModified(context, dojoAccess, dojoDebugger, dojoTracker));
                proxyFactory.proxyFunction(context, mod.Container, "_moveChildToBack", null, this._proxyGfxContainerModified(context, dojoAccess, dojoDebugger, dojoTracker));                    

            });
        },

        _proxyGfxSurfaceConstructor: function(context, dojoAccess, dojoDebugger, dojoTracker) {

            if(FBTrace.DBG_DOJO) {
                FBTrace.sysout("DOJO GFX creating gfx surface proxy");
                
            }

            var self = this;
            var fn =function(ret, args) {
               
                if(FBTrace.DBG_DOJO_DBG) {                        
                    FBTrace.sysout("DOJO DEBUG: Surface's constructor invoked with this args and result: ", { 'args':args, 'ret':ret});
                }

                dojoAccess.trackGFXSurface(this, context);
            };
            fn.dojoext_name = "_proxyGfxSurfaceConstructor";
            return fn;
        },
    
        _proxyGfxSurfaceDestructor: function(context, dojoAccess, dojoDebugger, dojoTracker) {

            if(FBTrace.DBG_DOJO) {
                FBTrace.sysout("DOJO GFX creating gfx surface proxy for destroy");
                
            }

            var self = this;
            var fn = function(ret, args) {
               
                if(FBTrace.DBG_DOJO_DBG) {                        
                    FBTrace.sysout("DOJO DEBUG: Surface's destroy invoked with this args and result: ", { 'args':args, 'ret':ret});
                }

                dojoAccess.untrackGFXSurface(this, context);
            };
            fn.dojoext_name = "_proxyGfxSurfaceDestructor";
            return fn;            
        },
    
        _proxyGfxContainerModified: function(context, dojoAccess, dojoDebugger, dojoTracker) {
            if(FBTrace.DBG_DOJO) {
                FBTrace.sysout("DOJO GFX creating gfx container proxy");
                
            }

            var self = this;
            var fn = function(ret, args) {
               
                if(FBTrace.DBG_DOJO_DBG) {                        
                    FBTrace.sysout("DOJO DEBUG: Container's modificationmethod invoked with this args and result: ", { 'args':args, 'ret':ret});
                }
                dojoAccess.gfxContainerStructureModified(this, context);
            };
            fn.dojoext_name = "_proxyGfxContainerModified";
            return fn;                        
        }

    });




    return DojoHooks;
});