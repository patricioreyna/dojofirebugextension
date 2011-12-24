// Test entry point.
function runTest()
{	

	setPreferences();
		
	FBTest.sysout("basic_connections test START");

	FBTest.openURL(basePath + "basic_subscriptions.html", function(win) {
		FBTest.openFirebug();
		FBTest.enableAllPanels();
		enableDojoPanel();
	    
		FBTest.reload(function(win){

			win = FBTest.FirebugWindow.FBL.unwrapObject(win);
			var DojoModel = FBTest.DojoExtension.DojoModel;
			var panel = FW.Firebug.chrome.selectPanel("dojofirebugextension"); //get our panel
			var context = FW.Firebug.currentContext; //context!
			
			try {
		    	var api = context.connectionsAPI;

		    	// Original subscriptions
		    	FBTest.compareHash(2, DojoModel.Subscription.prototype.getGlobalSubscriptionsForTopic(api, 'TOPIC 1').length, "Number of subscriptions for topic 'TOPIC 1' should be 2");
		    	FBTest.compareHash(2, DojoModel.Subscription.prototype.getGlobalSubscriptionsForTopic(api, 'TOPIC 2').length, "Number of subscriptions for topic 'TOPIC 2' should be 2");
		    	
		    	var sub = null;
		    	
		    	sub = DojoModel.Subscription.prototype.getGlobalSubscriptionsForTopic(api, 'TOPIC 1')[0];
		    	FBTest.compareHash(sub.context, win.objA, "The context prop for first subscription at TOPIC 1 should be objA.");
		        FBTest.compareHash(sub.method, 'funcTestA', "The method prop for first subscription at TOPIC 1 should be 'funcTestA'.");
		        
		        sub = DojoModel.Subscription.prototype.getGlobalSubscriptionsForTopic(api, 'TOPIC 1')[1];
		    	FBTest.compareHash(sub.context, win.objB, "The context prop for second subscription at TOPIC 1 should be objB.");
		        FBTest.compareHash(sub.method, 'funcTestB', "The method prop for second subscription at TOPIC 1 should be 'funcTestB'.");
		        
		        sub = DojoModel.Subscription.prototype.getGlobalSubscriptionsForTopic(api, 'TOPIC 2')[1];
		    	FBTest.compareHash(sub.context, win.objB, "The context prop for second subscription at TOPIC 2 should be objB.");
		    	
		    	// Unsubscribe Test
		    	FBTest.compareHash(false, api.getObserver(win.unsubscribeHandler) == undefined, "The unsuscribe handler is still being used");
		    	win.unsubscribeFirstSubscription();
		        FBTest.compareHash(1, DojoModel.Subscription.prototype.getGlobalSubscriptionsForTopic(api, 'TOPIC 1').length, "Unsubscribe made, number of subscriptions for topic 'TOPIC 1' should be 1");
		        FBTest.compareHash(true, api.getObserver(win.unsubscribeHandler) == undefined, "The unsubscribe subscription's data should not exist any more");

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
