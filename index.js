const AWS = require('aws-sdk');
AWS.config.update({
    region: 'us-east-1'
})

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const dynamoTableName = 'product_inventory';
const healthPath = '/health';
const productPath = '/product';
const productsPath = '/products';

function buildingResponse(statusCode, body) {
    return {
        statusCode: statusCode,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    }
}

async function getProduct(productId) {
    const params = {
        TableName: dynamoTableName,
        Key: {
            'productId': productId
        }
    }
    return await dynamoDB.get(params).promise().then((response) => {
        return buildingResponse(200, response.Item);
    }, (error) => {
        console.error('Error! Have some problems with database. LOG: ', error)
    });
}

async function scanDynamoRecords(scanParams, itemArray) {
    try {
        const dynamoData = await dynamoDB.scan(scanParams).promise();
        itemArray = itemArray.concat(dynamoData.Items);
        if (dynamoData.LastEvaluatedKey) {
            scanParams.ExclusiveStartkey = dynamoData.LastEvaluatedKey;
            return await scanDynamoRecords(scanParams, itemArray);
        }
        return itemArray;
    } catch (error) {
        console.error('Error! Have some problems with database. LOG: ', error);
    }
}

async function getProductList() {
    const params = {
        TableName: dynamoTableName
    }
    const allProducts = await scanDynamoRecords(params, []);
    const body = {
        products: allProducts
    }
    return buildingResponse(200, body);
}

async function saveProduct(newProduct) {
    const params = {
        TableName: dynamoTableName,
        Item: newProduct
    }
    return await dynamoDB.put(params).promise().then(() => {
        const body = {
            Operation: 'SAVE',
            Message: 'SUCCESS',
            Item: newProduct
        }
        return buildingResponse(200, body);
    }, (error) => {
        console.error('Error! Have some problems with database. LOG: ', error);
    });
}

async function updateProduct(productId, updateKey, updateValue) {
    const params = {
        TableName: dynamoTableName,
        Key: {
            'productId': productId
        },
        UpdateExpression: `set ${updateKey} = :value`,
        ExpressionAttributeValues: {
            ':value': updateValue
        },
        ReturnValues: 'UPDATED_NEW'
    }
    return await dynamoDB.update(params).promise().then((response) => {
        const body = {
            Operation: 'UPDATE',
            Message: 'SUCCESS',
            Item: response
        }
        return buildingResponse(200, body);
    }, (error) => {
        console.error('Error! Have some problems with database. LOG: ', error);
    })
}

async function deleteProduct(productId) {
    const params = {
        TableName: dynamoTableName,
        Key: {
            'productId': productId
        },
        ReturnValues: 'ALL_OLD'
    }
    return await dynamoDB.delete(params).promise().then((response) => {
        const body = {
            Operation: 'DELETE',
            Message: 'SUCCESS',
            Item: response
        }
        return buildingResponse(200, body);
    }, (error) => {
        console.error('Error! Have some problems with database. LOG: ', error);
    });
}

exports.handler = async function (event) {
    console.log('Request event: ', event);
    let response;
    switch (true) {
        case event.httpMethod === 'GET' && event.path === healthPath:
            response = buildingResponse(200);
            break;
        case event.httpMethod === 'GET' && event.path === productPath:
            response = await getProduct(event.queryStringParameters.productId);
            break;
        case event.httpMethod === 'GET' && event.path === productsPath:
            response = await getProductList();
            break;
        case event.httpMethod === 'POST' && event.path === productPath:
            response = await saveProduct(JSON.parse(event.body));
            break;
        case event.httpMethod === 'PATCH' && event.path === productPath:
            const requestBody = JSON.parse(event.body);
            response = await updateProduct(requestBody.productId, requestBody.updateKey, requestBody.updateValue);
            break;
        case event.httpMethod === 'DELETE' && event.path === productPath:
            response = await deleteProduct(JSON.parse(event.body).productId);
            break;

        default:
            response = buildingResponse(404, '404 Not found bro( ');
            break;
    }
    return response;
}