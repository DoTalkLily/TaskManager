'use strict';

var messages = {},
	lastUid = -1;

function hasKeys(obj){
	var key;

	for (key in obj){
		if ( obj.hasOwnProperty(key) ){
			return true;
		}
	}
	return false;
}

function deliverMessage( originalMessage, matchedMessage, data){
	var subscribers = messages[matchedMessage],s;

	if ( !messages.hasOwnProperty( matchedMessage ) ) {
		return;
	}

	for (s in subscribers){
		if ( subscribers.hasOwnProperty(s)){
			subscribers[s](originalMessage, data );
		}
	}
}

function createDeliveryFunction( message, data ){
	return function deliverNamespaced(){
		var topic = String( message ),
			position = topic.lastIndexOf( '.' );

		deliverMessage(message, message, data);

		// trim the hierarchy and deliver message to each level
		while( position !== -1 ){
			topic = topic.substr( 0, position );
			position = topic.lastIndexOf('.');
			deliverMessage( message, topic, data);
		}
	};
}

function messageHasSubscribers( message ){
	var topic = String( message ),
		found = Boolean(messages.hasOwnProperty( topic ) && hasKeys(messages[topic])),
		position = topic.lastIndexOf( '.' );

	while ( !found && position !== -1 ){
		topic = topic.substr( 0, position );
		position = topic.lastIndexOf( '.' );
		found = Boolean(messages.hasOwnProperty( topic ) && hasKeys(messages[topic]));
	}

	return found;
}

function publishData( message, data, sync){
	var deliver,
		hasSubscribers = messageHasSubscribers( message );

	if ( !hasSubscribers ){
		return false;
	}
	deliver = createDeliveryFunction( message, data );
	if ( sync === true ){
		deliver();
	} else {
		setTimeout( deliver, 0 );
	}
	return true;
}

/**
 *	PubSub.publish( message[, data] ) -> Boolean
 *	- message (String): The message to publish
 *	- data: The data to pass to subscribers
 *	Publishes the the message, passing the data to it's subscribers
**/
function publish( message, data ){
	return publishData( message, data, false);
};

/**
 *	PubSub.publishSync( message[, data] ) -> Boolean
 *	- message (String): The message to publish
 *	- data: The data to pass to subscribers
 *	Publishes the the message synchronously, passing the data to it's subscribers
**/
function publishSync( message, data ){
	return publishData( message, data, true);
};

/**
 *	PubSub.subscribe( message, func ) -> String
 *	- message (String): The message to subscribe to
 *	- func (Function): The function to call when a new message is published
 *	Subscribes the passed function to the passed message. Every returned token is unique and should be stored if
 *	you need to unsubscribe
**/
function subscribe( message, func ){
	if ( typeof func !== 'function'){
		return false;
	}

	// message is not registered yet
	if ( !messages.hasOwnProperty( message ) ){
		messages[message] = {};
	}

	// forcing token as String, to allow for future expansions without breaking usage
	// and allow for easy use as key names for the 'messages' object
	var token = 'uid_' + String(++lastUid);
	messages[message][token] = func;

	// return token for unsubscribing
	return token;
};

/* Public: Clears all subscriptions
 */
function clearAllSubscriptions(){
	messages = {};
};

/*Public: Clear subscriptions by the topic
*/
function clearSubscriptions(topic){
	var m;
	for (m in messages){
		if (messages.hasOwnProperty(m) && m.indexOf(topic) === 0){
			delete messages[m];
		}
	}
};

/* Public: removes subscriptions.
 * When passed a token, removes a specific subscription.
 * When passed a function, removes all subscriptions for that function
 * When passed a topic, removes all subscriptions for that topic (hierarchy)
 *
 * value - A token, function or topic to unsubscribe.
 *
 * Examples
 *
 *		// Example 1 - unsubscribing with a token
 *		var token = PubSub.subscribe('mytopic', myFunc);
 *		PubSub.unsubscribe(token);
 *
 *		// Example 2 - unsubscribing with a function
 *		PubSub.unsubscribe(myFunc);
 *
 *		// Example 3 - unsubscribing a topic
 *		PubSub.unsubscribe('mytopic');
 */
function unsubscribe(value){
	var isTopic    = typeof value === 'string' && messages.hasOwnProperty(value),
		isToken    = !isTopic && typeof value === 'string',
		isFunction = typeof value === 'function',
		result = false,
		m, message, t;

	if (isTopic){
		delete messages[value];
		return;
	}

	for ( m in messages ){
		if ( messages.hasOwnProperty( m ) ){
			message = messages[m];

			if ( isToken && message[value] ){
				delete message[value];
				result = value;
				// tokens are unique, so we can just stop here
				break;
			}

			if (isFunction) {
				for ( t in message ){
					if (message.hasOwnProperty(t) && message[t] === value){
						delete message[t];
						result = true;
					}
				}
			}
		}
	}
	return result;
};
var PubSub = {
	publish : publish,
	subscribe : subscribe,
	publishSync : publishSync,
	unsubscribe : unsubscribe,
	clearSubscriptions : clearSubscriptions,
	clearAllSubscriptions : clearAllSubscriptions
};
window.PubSub = PubSub;
module.exports =  PubSub;
