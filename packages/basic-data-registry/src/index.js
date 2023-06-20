export default class BasicDataRegistry {
    // safely add a function to the data registry, throwing an error if it has already been added
    AddDataFunction(name, dataFunc){
        if (this[name] !== undefined) {
            throw new Error('Data Registry function already registered');
        }
        if (typeof dataFunc !== 'function'){
            throw new Error('Data Registry function provided is not a function');
        }
        this[name] = dataFunc;
    }
}
