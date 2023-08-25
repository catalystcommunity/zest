// The point of a Data Service is to provide an API that makes sense for a given API contract, not to be
// prescriptive on how that API should be. This will only host nice-to-have helpers for encapsulating
// data so "state" can be accessed by components without their having to hold it at all
export default class BasicDataService {
    data; // Should only be accessed through the service

    constructor(){
        // This will expand a great deal when we have used it a few times and see patterns of what we may
        // need as helpers, but for now it's purely to encourage us to keep data in an encapsulated instance
        this.data = {};
    }
}
