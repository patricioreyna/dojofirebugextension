// Test entry point.
/***************************************************************************
* The use of the dijit.MenuItem widget involve an access to the __parent__ 
* property that generate an error, so a fix must be applied to avoid it.
***************************************************************************/
function runTest()
{	
	
	setPreferences();
	
	FBTest.sysout("menu_item test START");
	
	FBTest.openURL(basePath + "menu_item.html", function(win) {
		FBTest.openFirebug();
	    FBTest.enableAllPanels();
	    enableDojoPanel();
	    
		FBTest.reload(function(win){
			win = FBTest.FirebugWindow.FBL.unwrapObject(win);
			var DojoModel = FBTest.DojoExtension.DojoModel;
			var panel = FW.Firebug.chrome.selectPanel("dojofirebugextension"); //get our panel
			var context = FW.Firebug.currentContext; //context!
			
			try {
		    	var api = context.tracker;
		    	var conns = DojoModel.Connection.prototype.getGlobalConnections(api);
		    	
		    	// compare number of registered connections
		        FBTest.compare(18, conns.length, "number of connections made should be 18");

			} catch (err) {
		        FBTest.exception("Test: ", err);
		    } finally {
		        FBTest.testDone();
		    }	
		});
	});
}
