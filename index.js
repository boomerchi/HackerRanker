/**
 * Created by lmarkus on 8/13/16.
 */
'use strict';
const async = require('async');
const request = require('request');
const config = require('./config.json');
const template = require('lodash.template');
const debug = require('util').debuglog('HACK');
const participants = require('./participants.json') || []; //Array with HackerRank usernames
const contestUrl = template(config.urls.contestParticipation);

/**
 * Given a HackerRank paginated URL, recursively find a specific entry across all pages.
 * @param urlTemplate templatized url that the model will be applied to.
 * @param model expecting at a minimun {offset,limit}, can include other data to interpolate with the URL
 * @param test Test function to apply to a given entry. If truthy invoke the callback.
 * @param callback
 */
function findInBook(urlTemplate, model, test, callback) {

    //Fetch current page, as specified in model.offset
    request(urlTemplate(model), function (err, response, body) {
        debug(model, err, response.statusCode, body);
        if (err) {
            return callback(err);
        }

        body = JSON.parse(body);
        let entry = test(body.models); //HackerRack API always returns a {models:[],totals:N} object.
        if (entry) {
            debug('Found ', entry)
            return callback(null, entry);
        }
        else { //go to next page (if any)
            debug('Next Page');
            model.offset += model.limit;
            if (model.offset >= body.total) {
                debug('No more pages');
                return callback(); //No more pages :'(
            }
            return findInBook(urlTemplate, model, test, callback);
        }
    });
}

//Contest name matches?
let test = function (data) {
    return data.find(function (d) {
        return d.name === config.contestName;
    })
};


/*Run the search*/
let results = [];
async.eachLimit(participants, 10, //Limited to 10 parallel operations. Playing nice...
    (participant, next) => {

        //Look in the "Contest History" section of the participants profile.
        let model = {participant, offset: 0, limit: 10};
        findInBook(contestUrl, model, test, (err, contest)=> {
            results.push({participant, hacker_rank: contest.hacker_rank});
            return next(err);
        });
    },
    (err)=> {

        if(err){
            return console.log(err);
        }

        results.sort((a, b)=> {
            //NOTE: Reverse sort. A smaller number means a higher ranking.

            //Unranked (--) means no challenges submitted, move to the bottom.
            if (a.hacker_rank === '--') {
                return 1;
            }

            return a.hacker_rank - b.hacker_rank
        });
        console.log(results);
    });



