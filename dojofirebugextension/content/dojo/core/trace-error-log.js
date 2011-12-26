/* Released under BSD license (see license.txt) */

/**
 * hack used with fb 1.8 to replace not-working FBTRace with FF's Error Log so we can trace 
 * @author preyna@ar.ibm.com
 */
define(["firebug/lib/trace"
        ], function TraceErrorLogFactory(FBTrace)
{

    //HACK    
    fbDojo_fbTraceReplacementUsingErrorLogEnabled = true;

    if(fbDojo_fbTraceReplacementUsingErrorLogEnabled) {
        var fbTraceReplacementUsingErrorLogEnabled_logMsg = function(aMessage) {
            var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
                                           .getService(Components.interfaces.nsIConsoleService);
            consoleService.logStringMessage(aMessage);
        };
        FBTrace.sysout = function(message, obj) {
            if (message instanceof Error) {
                var e = message;
                message = "ERROR - message: ["+ e.message + "] fileName: " + e.fileName + " lineNumber: " + e.lineNumber;
            } else if (obj && obj instanceof Error) {
                var e = obj;
                obj = "ERROR - message: ["+ e.message + "] fileName: " + e.fileName + " lineNumber: " + e.lineNumber;
            } else if (obj && obj.length) {
                var a = obj;
                obj = "[";
                for(var i=0; i<a.length; i++) { obj += a[i] + ", "; }
                obj += "]";
            }
            fbTraceReplacementUsingErrorLogEnabled_logMsg(message + (obj || ""));        
        };
        
        //FBTrace options configuration
        FBTrace.DBG_DOJO = true;
        FBTrace.DBG_DOJO_CONN_COUNTER = true;
        FBTrace.DBG_DOJO_DBG_HANDLES = false;
        FBTrace.DBG_DOJO_DBG_DOC = false;
        FBTrace.DBG_DOJO_CONTEXTMENU = false; 
        FBTrace.DBG_DOJO_DBG_VERSIONS = true;
        
    }
    //end HACK

        
    return {}; 
});