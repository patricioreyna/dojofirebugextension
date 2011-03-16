// Test entry point.
function runTest()
{
//    var Firebug = FBTest.FirebugWindow.Firebug;
//    var FBTrace = FBTest.FirebugWindow.FBTrace;

//    var DojoExt = FBTest.FirebugWindow.Firebug.
    
    //FBTest.ok(FBTest.isFirebugOpen(), "Firebug is not open!");
	
	
	FBTest.sysout("someWidgets START");
	//FBTestFirebug.openNewTab(basePath + "inspector/InspectorTestIframe.htm?url=Issue68BoxExpected.htm", function(win) {});
	FBTest.enableAllPanels();
	FBTest.openURL(basePath + "someWidgets.html", function(win) {
		win = FBTest.FirebugWindow.FBL.unwrapObject(win);
	    FBTest.openFirebug();

	    try {
	    	var panel = FW.FirebugChrome.selectPanel("dojofirebugextension"); //get our panel
	    	var context = FW.FirebugContext; //context!
	    	var widgets = panel.getWidgets(context); //method being tested

	    	/*
	    	 * NOTE: if the model is using the original getWidgets impl, there should be 14 widgets.
	    	 * If using the dijit.registry.toArray() there should be 36 
	    	 */
	        FBTest.compare(36, widgets.length, "the must be 36 widgets");
	    	
	    } catch (err) {
	        FBTest.exception("Test: ", err);
	    } finally {
	        FBTest.testDone();
	    }
	    
		
	});
    
/* to have as example of loading lib (using "with") inside a callback

    FBTestFirebug.openNewTab(basePath + "chrome/1883/issue1883.html", function(win) {
        with (FBTest.FirebugWindow.FBL) { with (FBTest.FirebugWindow) {
            FBTestFirebug.testDone();
        }}
    });
*/
}

