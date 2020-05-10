const { getUserId } = require('./../utils')
const moment = require('moment')

function accounts(parent, args, ctx, info) {
    const userId = getUserId(ctx)
    return ctx.db.query.accounts({
        where: {
            OR: [
                {
                    user: {
                        id: userId
                    }
                },
                {
                    user: null
                }
            ]
        },
        orderBy: 'description_ASC'
    }, info)
}

function categories(_, { operation }, ctx, info) {
    const userId = getUserId(ctx)

    let AND = [
        {
            OR: [
                { user: { id: userId  }},
                { user: null }
            ]
        }
    ] 

    AND = !operation ? AND : [ ...AND, { operation: operation }]

    return ctx.db.query.categories({
        where: { AND },
        orderBy: 'description_ASC'
    }, info)
}

function records(_, {month, type, accountsIds, categoriesIds }, ctx, info) {
    const userId = getUserId(ctx)

    let AND = [ { user: {id: userId}}]
    AND = !type ? AND : [ ...AND, { type: type } ]

    AND = !accountsIds || accountsIds.lenght === 0
    ? AND
    : [
        ...AND,
        { OR: accountsIds.map(id => ({ accounts: { id: id}}))}
    ]

    AND = !categoriesIds || categoriesIds.lenght === 0
    ? AND
    : [
        ...AND,
        { OR: categoriesIds.map(id => ({ category: { id: id}}))}
    ]

    if(month){
        const date = moment(month, 'MM-YYYY')
        const startDate = date.startOf('month').toISOString()
        const endDate = date.endOf('month').toISOString()
        AND = [
            ...AND,
            { date_gte: startDate},
            { date_lte: endDate}
        ]
        console.log('Base date: ', date.toISOString())
        console.log('Start date: ', startDate)
        console.log('End date: ', endDate)
    }

    return ctx.db.query.records({
        where: { AND: AND},
        orderBy: 'date_ASC'
    }, info)
}

function totalBalance(_, { date}, ctx, info) {
    const userId = getUserId(ctx)
    const dateISO = moment(date, 'YYYY-MM-DD').endOf('day').toISOString()
    const pgSchema = `${process.env.PRISMA_SERVICE}$${process.env.PRISMA_STAGE}`

    const mutation = `
       mutation TotalBalance($database: PrismaDatabase, $query: String!) {
           executeRaw(database: $database, query: $query)
       }
    `
    const variables = {
        database: 'default',
        query:`
        select sum("${pgSchema}"."Record"."amount") as totalbalance
        from "${pgSchema}"."Record"
        inner join "${pgSchema}"."_RecordToUser"
        on "${pgSchema}"."_RecordToUser"."A" = "${pgSchema}"."Record"."id"
        where "${pgSchema}"."_RecordToUser"."B" = '${userId}'
        and "${pgSchema}"."Record"."date" <= '${dateISO}'
        `
    }

    console.log('pgSchema: ', pgSchema)
    console.log('query: ', variables.query)

    return ctx.prisma.$graphql(mutation, variables)
    .then(response => {
        console.log('Response: ', response)
        const totalBalance = response.executeRaw[0].totalbalance
        return totalBalance ? totalBalance : 0
    })
}

function user(parent, args, ctx, info) {
    const userId = getUserId(ctx)
    return ctx.db.query.user({ where: { id: userId } }, info)
        .then(user => {
            return user
        })
}

module.exports = {
    accounts,
    categories,
    records,
    totalBalance,
    user
}