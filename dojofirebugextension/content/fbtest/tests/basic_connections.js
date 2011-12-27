// Test entry point.
function runTest()
{	
	setPreferences();
	
	FBTest.sysout("basic_connections test START");

	FBTest.openURL(basePath + "basic_connections.html", function(win) {
		FBTest.openFirebug();
	    FBTest.enableAllPanels();
	    enableDojoPanel();
	    
		FBTest.reload(function(win){
			win = FBTest.FirebugWindow.FBL.unwrapObject(win);
			var panel = FW.Firebug.chrome.selectPanel("dojofirebugextension"); //get our panel
			var context = FW.Firebug.currentContext; //context!
			
			try {
		    	var api = context.tracker;
		    	var DojoModel = FBTest.DojoExtension.DojoModel;
		    	var conns = DojoModel.Connection.prototype.getGlobalConnections(api);
		    		    	
		    	// compare number of registered connections
		        FBTest.compare(4, conns.length, "number of connections made should be 4");
		        
		        // Connections types
		        var con = null;
		        
		        // ObjA

		        var objAConInfo = api.getTrackingInfoFor(win.objA, true);
		        FBTest.compare(2, DojoModel.Connection.prototype.getOutgoingConnectionsMethods(objAConInfo).length, "ObjA has outgoing connections for 2 functions");
		        	// 'funcTest'
		        con = DojoModel.Connection.prototype.getOutgoingConnectionsForMethod(objAConInfo, 'funcTest')[0];
		        FBTest.compareHash(con.obj, win.button , "The obj prop for outgoing connection for function 'funcTest' should be 'button'.");
		        FBTest.compareHash(con.event, 'onclick' , "The event prop for outgoing connection for function 'funcTest' should be 'onclick'.");
		        	// win.objA.funcTest
		        con = DojoModel.Connection.prototype.getOutgoingConnectionsForMethod(objAConInfo, win.objA.funcTest)[0];
		        FBTest.compareHash(con.obj, win.button, "The obj prop for outgoing connection for function objA.funcTest should be button.");
		        FBTest.compareHash(con.event, 'onblur', "The event prop for outgoing connection for function objA.funcTest should be 'onblur'.");
		        
		        // Button
		        var buttonConInfo = api.getTrackingInfoFor(win.button, true);
		        FBTest.compare(4, DojoModel.Connection.prototype.getIncommingConnectionsForEvent(buttonConInfo, 'onclick').length 
		        		+ DojoModel.Connection.prototype.getIncommingConnectionsForEvent(buttonConInfo, 'onblur').length, 
		        		"Button has 4 incomming connections ('onclick':2 & 'onblur':2)");
		        FBTest.compare(1, DojoModel.Connection.prototype.getOutgoingConnectionsMethods(buttonConInfo).length, "Button has outgoing connections for 1 function");
		        
		        // Window
//		        var windowConInfo = api.getConnection(win.dojo.global);
//		        FBTest.compare(1, windowConInfo.getOutgoingConnectionsMethods().length, "Window has outgoing connections for the funcion functionGlobal");
		        
		        
		        // Disconnection Test
		        FBTest.compare(false, api.getObserver(win.disconnectHandler) == undefined, "The disconnect handler is still being used!");
		        win.disconnectFirstConnection();
		        FBTest.compare(3, conns.length, "Disconnection made, number of connection should be 3");
		        FBTest.compare(true, api.getObserver(win.disconnectHandler) == undefined, "The disconnected connection's data should not exist any more");
		        
		        // TODO: Check befere a disconnections that the info in the structure was removed too (tip: use the info in con)
		        // TODO: Add asserts for widget connections		        

			} catch (err) {
		        FBTest.exception("Test: ", err);
		    } finally {
		        FBTest.testDone();
		    }	
		});
	});
}

function applyTests(context) {

}
