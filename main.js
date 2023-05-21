const modelSpecification = `
% Constants
int: number_of_teams;
constraint assert( number_of_teams > 0, "Error: number of teams must be greather than 0");
constraint assert( number_of_teams mod 2 == 0, "Error: number of teams must be even");

int: min_for_permanency_or_tour;
int: max_for_permanency_or_tour;
constraint assert( min_for_permanency_or_tour > 0, "Error: min for permanency or tour must be greather than 0");
constraint assert( max_for_permanency_or_tour > 0, "Error: max for permanency or tour must be greather than 0");
constraint assert( min_for_permanency_or_tour < max_for_permanency_or_tour, "Error: max for permanency or tour must be greather or equal than min for permanency or tour");


int: number_of_dates = (2*(number_of_teams-1));

set of int: teams_in_negative = -1*number_of_teams..-1;
set of int: teams = 1..number_of_teams;
set of int: dates = 1..number_of_dates;
set of int: calendar_values = teams_in_negative union teams;

array[teams,teams] of int: distance_per_team;
constraint assert( forall(i in teams, j in teams)(
  distance_per_team[i,j] >= 0
), "Error: distance must be greather or equal 0");

% Decision variables
array [dates, teams] of var calendar_values: calendar_of_matches;

% a team plays against other team in a date as local only and only if the other team plays as visitor
constraint forall(date in dates, team in teams, k in teams)(
      calendar_of_matches[date,team] == k <->  calendar_of_matches[date,k] ==  team*-1 
);


% for all dates half the matches are local and half visitors
constraint forall(date in dates)(
      sum(team in teams)(bool2int(calendar_of_matches[date, team] in teams)) == 
      sum(team in teams)(bool2int(calendar_of_matches[date, team] in teams_in_negative)) /\\
      sum(team in teams)(bool2int(calendar_of_matches[date, team] in teams)) == number_of_teams/2
);

% for each team there has to be two dates, one in which a team plays as local and other where it plays as visitor for all other teams
constraint forall(team in teams)(
      forall(k in teams where k != team)(
            exists(date_one in dates, date_two in dates)(
              calendar_of_matches[date_one,team] == k /\\ calendar_of_matches[date_two,team] == -1*k
            )
      )
);

% each team is in a permanency or team wich is greater or equal to the min_for_permanency_or_tour
constraint forall(team in teams, date in dates)(
    exists(leftLimit in dates, rightLimit in dates where leftLimit <= date /\\ rightLimit >= date)(
        rightLimit - leftLimit + 1 >= min_for_permanency_or_tour
        /\\
        forall(value in leftLimit..rightLimit)(
          calendar_of_matches[value, team] > 0
        )  
        \\/
        forall(value in leftLimit..rightLimit)(
          calendar_of_matches[value, team] < 0
        )
    )
);

% for a team there is no permanency or tour that are greater than the max 
constraint forall(team in teams)(
    not exists(
      leftLimit in dates, 
      rightLimit in dates where 
      leftLimit <= rightLimit /\\
      (
        forall(value in leftLimit..rightLimit)(
            calendar_of_matches[value, team] > 0
        )
        \\/
        forall(value in leftLimit..rightLimit)(
            calendar_of_matches[value, team] < 0
        )
      )
    )
    (
        rightLimit - leftLimit + 1 > max_for_permanency_or_tour
    )    
);

% in two consecutives dates there cannot be the same match
constraint forall(date in 1..number_of_dates-1, team in teams)( 
     abs(calendar_of_matches[date,team]) != abs(calendar_of_matches[date+1,team])
);


% Objective
var int: expenses; 

constraint expenses = sum(date in 0..number_of_dates, team in teams)(
  if date == 0 then % before first row
       if calendar_of_matches[date+1,team] < 0 then % from local to visitor
        distance_per_team[abs(calendar_of_matches[date+1,team]),team] 
       else
          distance_per_team[team,team] 
       endif
  elseif date == number_of_dates then %last row
       if calendar_of_matches[date,team] < 0 then   % from visitor to local
          distance_per_team[team,abs(calendar_of_matches[date,team])] 
       else
          distance_per_team[team,team] 
       endif
  elseif calendar_of_matches[date,team] > 0 /\\ calendar_of_matches[date+1,team] < 0 then % from local to visitor
    distance_per_team[abs(calendar_of_matches[date+1,team]),team]
   
  elseif calendar_of_matches[date,team] < 0 /\\ calendar_of_matches[date+1,team] < 0 then % from visitor to visitor
    distance_per_team[abs(calendar_of_matches[date+1,team]),abs(calendar_of_matches[date,team])]
    
  elseif calendar_of_matches[date,team] < 0 /\\ calendar_of_matches[date+1,team] > 0 then % from visitor to local
    distance_per_team[team,abs(calendar_of_matches[date,team])] 
  else
    distance_per_team[team,team] 
  endif 
);

solve minimize expenses;
` 

const READY_STATUS = "Ready!"
const FAILURE_STATUS = "Something went wrong, try again ✗"
const LOADING_STATUS = "Loading..⧗"
const SUCCESS_STATUS = "Success ✓"

const ERRINVALIDFILEFORMAT = "error invalid file format"

let instancesRunning = 0

async function runModel(event){
    event.preventDefault()

    if (instancesRunning > 0)  {
      window.alert("Only one model can be running at a time")

      return 
    }

    instancesRunning += 1

    showMessageForStatus("")
    clearOutput()

    try {
        model = await getModelReady()
        solveModel(model)

    } catch (e) {
        instancesRunning = 0
        showMessageForStatus("failure")
        console.error(e)
        if ( e === ERRINVALIDFILEFORMAT){
          window.alert(ERRINVALIDFILEFORMAT)
        }
    } 
}

async function getModelReady(){
    const fileInput = document.getElementById("modelFileInput")
    const modelData = await fileInput.files[0].text()


    let res = translateInput(modelData)
    if (res === ERRINVALIDFILEFORMAT){
      throw ERRINVALIDFILEFORMAT
    }

    const model = new MiniZinc.Model();

    model.addDznString(res);
    model.addFile('model.mzn', modelSpecification);

    return model
}

function solveModel(model){
    const solve = model.solve({
        options: {
          solver: 'gecode',
          'all-solutions': true
        }
    });

    showMessageForStatus("loading")
    
    stopAfterTime(solve)
    
    handleError(solve)

    handleSuccess(solve)
}


function showMessageForStatus(status){
    const statusElement = document.getElementById("status")

    statusElement.classList.remove("terminal-alert-primary", "terminal-alert-error")

    switch (status) {
        case "success":
            statusElement.innerText = SUCCESS_STATUS
            statusElement.classList.add("terminal-alert-primary")

            break;
        case "loading":
            statusElement.innerText = LOADING_STATUS

            break;
        
        case "failure":
            statusElement.innerText = FAILURE_STATUS
            statusElement.classList.add("terminal-alert-error")

            break;
    
        default:
            statusElement.innerText = READY_STATUS

            break;
    }
}


function showOutput(output){
    const codeOutput = document.getElementById("codeOutput")

    calendar = []
    for(row in output.result?.calendar_of_matches)  {
        ca = JSON.stringify(output.result.calendar_of_matches[row])
        calendar.push(ca)
    }
  
    if (output.result !== undefined){
      output.result.calendar_of_matches = calendar
    }
   
    const myHtml = hljs.highlight(JSON.stringify(output, null, 2), { language: 'json' }).value
    codeOutput.innerHTML = myHtml
}

function clearOutput(){
    const codeOutput = document.getElementById("codeOutput")
    codeOutput.innerHTML = ""
}

function stopAfterTime(solve) { // stop the model after 1 minute
  setTimeout(() => {
    if (solve.isRunning()) {
        try {
            solve.cancel();
        }catch(e){
            instancesRunning = 0
            console.error(e)
        }
        showMessageForStatus("failure")
        window.alert("Model stoped, took more than 1 minute")            
    }
  }, 60000); 
}

function handleError(solve){
  solve.on('error', e => {
    showMessageForStatus("failure")
    console.error(e)
    try {
        solve.cancel();
    }catch(e){
        instancesRunning = 0
        console.error(e)
    }
});
}

function handleSuccess(solve){
  solve.then(result => {
    instancesRunning = 0 //important so other models can be run, it must be present if an error ocurrs inside a promise
    
    showMessageForStatus("success")
 
    showOutput({
      status: result.status,
      result: result.solution?.output?.json
    })
});
}

function translateInput(input){
  rows = getRowsReady(input)

  if (rows.length <= 3){
    return ERRINVALIDFILEFORMAT
  }


  let threeFirstValues = getThreeFirstValues(rows)
  if (threeFirstValues === ERRINVALIDFILEFORMAT){
    return ERRINVALIDFILEFORMAT
  }

  let numberOfTeams = getInteger(threeFirstValues[0])

  if (rows.length < 3 + numberOfTeams ){
    return ERRINVALIDFILEFORMAT
  }

  let teamsCosts = getTeamCosts(rows, numberOfTeams)
  if (teamsCosts === ERRINVALIDFILEFORMAT){
    return ERRINVALIDFILEFORMAT
  }

  return translateToMinizinc(threeFirstValues, teamsCosts)
}


function getRowsReady(input){
  input = input.trim()
  let rows = input.split(/\r\n|\n/)

  for(let i =0; i < rows.length; i++){
    rows[i] = rows[i].trim()
  }

  return rows
}

function getInteger(input){
  let number = parseInt(input)

  if ( isNaN(number) || number < 0 || !Number.isInteger(number) ) {
    return ERRINVALIDFILEFORMAT
  }

  return number
}

function getThreeFirstValues(rows){
  let vals = []

  for (let i = 0; i < 3; i++){
    let number = getInteger(rows[i])
    if (number === ERRINVALIDFILEFORMAT){
      return ERRINVALIDFILEFORMAT
    }

    vals.push(number)
  }

  return vals
}

function getTeamCosts(rows, numberOfTeams){
  costs = []

  for(let i = 3; i < rows.length; i++ ){
    let row = rows[i]

    let columns = row.split(" ")
    if (columns.length < numberOfTeams){
      return ERRINVALIDFILEFORMAT
    }

    let costsRow = []
    for(let j = 0; j < columns.length; j++){
      let number = getInteger(columns[j])
      if (number === ERRINVALIDFILEFORMAT){
        return ERRINVALIDFILEFORMAT
      }
  
      costsRow.push(number)
    }

    costs.push(costsRow)
  }

  return costs
}

function translateToMinizinc(threeFirstRows, costs){
  let distancePerTeam = `[`
  
  for (let i = 0; i < costs.length; i++) {
    const row = costs[i];

    let rowValue = `|`
    for (let j = 0; j < row.length; j++) {
      const col = row[j];
      rowValue += ` ${col},`
    }

    rowValue += '\n'
    distancePerTeam += rowValue
  }

  distancePerTeam += ' |]'

  return   `number_of_teams = ${threeFirstRows[0]};
  min_for_permanency_or_tour = ${threeFirstRows[1]};
  max_for_permanency_or_tour = ${threeFirstRows[2]};
  distance_per_team = ${distancePerTeam};
  `
}