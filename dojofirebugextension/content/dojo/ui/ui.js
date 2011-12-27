/* Released under BSD license (see license.txt) */
/*
 * Copyright IBM Corporation 2010, 2010. All Rights Reserved. 
 * U.S. Government Users Restricted Rights -  Use, duplication or disclosure restricted by GSA ADP 
 * Schedule Contract with IBM Corp. 
 */


/**
 * UI main def - Static utility methods
 * @author preyna@ar.ibm.com
 * @author fergom@ar.ibm.com
 */
define([
        "firebug/firebug",
        "firebug/js/stackFrame",
        "firebug/lib/css"
       ], function dojoUIHelperFactory(Firebug, StackFrame, Css)
{

    //the name of our strings bundle
    var DOJO_BUNDLE = "fbDojo_dojostrings";    
    var DOJO_EXT_CSS_URL = "chrome://dojofirebugextension/skin/dojofirebugextension.css";
        
    //Extend string bundle with new strings for this extension.
    //This must be done yet before domplate definitions.
    if (Firebug.registerStringBundle) {
        Firebug.registerStringBundle("chrome://dojofirebugextension/locale/dojo.properties");    
    }

    var UI = {};

 // ***************************************************************
 
    
    var getMethodLabel = UI.getMethodLabel = function(method) {
        
        // FIXME: method should not be undefined, but it happens. Alert about this situation.
        if(!method) {
            return "undefined"; 
        }

        var label = '';
        if (typeof(method) == "string") {
            //it's an event string most likely. Return it directly , without adding the ending '()'
            return method;
            //label = method;
        } else if(method.displayName) {
            label = method.displayName;
        } else if(method.__dojoExtDisplayNameCache) {
            label = method.__dojoExtDisplayNameCache;
        } else {
            //xxxPERFORMANCE
            //TODO encapsulate in our debugger file
            var script = Firebug.SourceFile.findScriptForFunctionInContext(Firebug.currentContext, method);            
            try {
                label = script ? StackFrame.getFunctionName(script, Firebug.currentContext) : method.name;
            } catch(exc) {
                //$$HACK
                label = method.name;
            }
            if(label) {
                label = label + ((label.indexOf(')') != -1) ? "" : "()");   
            }
            method.__dojoExtDisplayNameCache = label;
        }
        return label;
    };
    
    
    /**
     * Return the visibility value for the parameter.
     * @param visibility the visibility
     */
    var getVisibilityValue = UI.getVisibilityValue = function(visibility){
        return visibility ? 'inherit' : 'none';
    };
       
    /**
     * sets our default css styles to a given document.
     * This method is used by the panels on this file.
     */
    var addStyleSheet = UI.addStyleSheet = function(doc) {
        Css.appendStylesheet(doc, DOJO_EXT_CSS_URL);
    };        
    

     
          
     
 // ***************************************************************
 // exported classes
 // ***************************************************************    
   
    UI.DOJO_BUNDLE = DOJO_BUNDLE;
    
    return UI;
});
    