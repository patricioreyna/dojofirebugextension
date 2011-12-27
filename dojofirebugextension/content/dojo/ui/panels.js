/* Released under BSD license (see license.txt) */
/*
 * Copyright IBM Corporation 2010, 2010. All Rights Reserved. 
 * U.S. Government Users Restricted Rights -  Use, duplication or disclosure restricted by GSA ADP 
 * Schedule Contract with IBM Corp. 
 */


/**
 * The panels' loader main file (UI) of this extension
 * @author preyna@ar.ibm.com
 * @author fergom@ar.ibm.com
 */
define([
        "firebug/lib/trace",
        "dojo/ui/panels/mainPanel",
        "dojo/ui/panels/panelCommons"
       ], function dojoPanelsFactory(FBTrace, DojoMainPanel, DojoPanels)
{


    DojoMainPanel.registerPanel();
    
    return DojoPanels;
});
